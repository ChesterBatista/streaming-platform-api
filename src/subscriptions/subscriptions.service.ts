import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/utils/pagination';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PlanStatus, SubscriptionStatus, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionStatusDto } from './dto/update-subscription-status.dto';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubscriptionDto) {
    return this.writeTransaction(async (tx) => {
      this.validateId(dto.userId);
      this.validateId(dto.planId);
      const now = new Date();
      const expiresAt = dto.expiresAt == null ? null : new Date(dto.expiresAt);
      if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now)) {
        throw new BadRequestException('A expiração deve ser posterior ao início da assinatura.');
      }

      await this.requireActiveReferences(tx, dto.userId, dto.planId);
      await this.ensureNoConflict(tx, dto.userId, dto.planId, now);

      return tx.subscription.create({
        data: {
          userId: dto.userId,
          planId: dto.planId,
          status: SubscriptionStatus.ACTIVE,
          startsAt: now,
          expiresAt,
        },
      });
    });
  }

  async findMine(userId: number) {
    this.validateId(userId);
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (subscriptions.length === 0) {
      throw new NotFoundException('Nenhuma assinatura encontrada para o usuário autenticado.');
    }
    return subscriptions;
  }

  async findAll(pagination: PaginationQueryDto) {
    const where = {};
    return paginate(pagination, this.prisma.subscription.count({ where }), (range) => this.prisma.subscription.findMany({
      ...range,
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }));
  }

  async findOne(id: number) {
    return this.requireSubscription(this.prisma, id);
  }

  async updateStatus(id: number, dto: UpdateSubscriptionStatusDto) {
    return this.writeTransaction(async (tx) => {
      const subscription = await this.requireSubscription(tx, id);
      const now = new Date();
      const transitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
        ACTIVE: [SubscriptionStatus.INACTIVE, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
        INACTIVE: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED],
        CANCELLED: [],
        EXPIRED: [],
      };
      if (!transitions[subscription.status].includes(dto.status)) {
        throw new ConflictException('Transição de status incompatível com o estado atual.');
      }

      const expired = subscription.expiresAt !== null && subscription.expiresAt <= now;
      if (dto.status === SubscriptionStatus.EXPIRED && !expired) {
        throw new ConflictException('A assinatura só pode ser marcada como EXPIRED após sua expiração.');
      }
      if (expired && (dto.status === SubscriptionStatus.ACTIVE || dto.status === SubscriptionStatus.INACTIVE)) {
        throw new ConflictException('A vigência terminou. Cancele ou marque a assinatura como EXPIRED.');
      }

      if (dto.status === SubscriptionStatus.ACTIVE) {
        if (subscription.startsAt > now) {
          throw new ConflictException('A assinatura ainda não iniciou sua vigência.');
        }
        await this.requireActiveReferences(tx, subscription.userId, subscription.planId);
        await this.ensureNoConflict(tx, subscription.userId, subscription.planId, now, id);
      }

      return tx.subscription.update({ where: { id }, data: { status: dto.status } });
    });
  }

  private validateId(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('O ID deve ser um inteiro positivo de até 2147483647.');
    }
  }

  private async requireSubscription(tx: Prisma.TransactionClient, id: number) {
    this.validateId(id);
    const subscription = await tx.subscription.findUnique({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada.');
    }
    return subscription;
  }

  private async requireActiveReferences(tx: Prisma.TransactionClient, userId: number, planId: number) {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    const plan = await tx.plan.findUnique({ where: { id: planId }, select: { status: true } });
    if (!plan) {
      throw new NotFoundException('Plano não encontrado.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ConflictException('O usuário deve estar ativo para criar ou ativar uma assinatura.');
    }
    if (plan.status !== PlanStatus.ACTIVE) {
      throw new ConflictException('O plano deve estar ativo para criar ou ativar uma assinatura.');
    }
  }

  private async ensureNoConflict(
    tx: Prisma.TransactionClient,
    userId: number,
    planId: number,
    now: Date,
    excludeId?: number,
  ) {
    const existing = await tx.subscription.findFirst({
      where: {
        userId,
        planId,
        ...(excludeId !== undefined && { id: { not: excludeId } }),
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.INACTIVE] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Já existe uma assinatura não encerrada para este usuário e plano.');
    }
  }

  private async writeTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // O schema não tem unicidade por usuário/plano. Serializable protege a
    // verificação seguida de escrita entre requisições deste módulo.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034') {
            if (attempt < 2) continue;
            throw new ConflictException('A assinatura foi alterada simultaneamente. Tente novamente.');
          }
          if (error.code === 'P2002') {
            throw new ConflictException('Já existe uma assinatura com os dados informados.');
          }
          if (error.code === 'P2003' || error.code === 'P2025') {
            throw new NotFoundException('Assinatura, usuário ou plano não encontrado.');
          }
        }
        throw error;
      }
    }
    throw new ConflictException('Não foi possível concluir a operação devido a alterações simultâneas.');
  }
}
