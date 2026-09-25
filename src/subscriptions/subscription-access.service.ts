import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { Prisma } from '../generated/prisma/client';
import { ContentStatus, PlanStatus, SubscriptionStatus, UserRole, UserStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { validatePersonalContentId } from '../common/utils/personal-resource';

@Injectable()
export class SubscriptionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  private activeWhere(userId: number, now: Date): Prisma.SubscriptionWhereInput {
    return {
      userId,
      status: SubscriptionStatus.ACTIVE,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      plan: { status: PlanStatus.ACTIVE },
      user: { status: UserStatus.ACTIVE },
    };
  }

  contentWhere(user: AuthenticatedUser, now = new Date()): Prisma.ContentWhereInput {
    if (user.role === UserRole.ADMIN || user.role === UserRole.CONTENT_MANAGER) {
      return {};
    }
    if (user.role !== UserRole.SUBSCRIBER) {
      throw new ForbiddenException('Você não possui permissão para consultar conteúdos.');
    }
    return {
      status: ContentStatus.PUBLISHED,
      plans: {
        some: {
          plan: {
            subscriptions: { some: this.activeWhere(user.id, now) },
          },
        },
      },
    };
  }

  async assertCanList(user: AuthenticatedUser, now = new Date()) {
    if (user.role === UserRole.ADMIN || user.role === UserRole.CONTENT_MANAGER) return;
    if (user.role !== UserRole.SUBSCRIBER) {
      throw new ForbiddenException('Você não possui permissão para consultar conteúdos.');
    }
    const subscription = await this.prisma.subscription.findFirst({
      where: this.activeWhere(user.id, now),
      select: { id: true },
    });
    if (!subscription) {
      throw new ForbiddenException('É necessária uma assinatura ativa e vigente em um plano ativo.');
    }
  }

  async requireAccessibleContent(
    id: number,
    user: AuthenticatedUser,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    validatePersonalContentId(id);
    const content = await tx.content.findFirst({
      where: { id, ...this.contentWhere(user) },
      select: { id: true, durationMinutes: true },
    });
    if (!content) return this.throwContentReadError(id, user, tx);
    return content;
  }

  async throwContentReadError(
    id: number,
    user: AuthenticatedUser,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<never> {
    // Só classifica uma consulta já negada. Nunca libera dados por uma segunda
    // consulta sem o predicado completo de autorização.
    if (user.role === UserRole.SUBSCRIBER) {
      const published = await tx.content.findFirst({
        where: { id, status: ContentStatus.PUBLISHED },
        select: { id: true },
      });
      if (published) {
        throw new ForbiddenException('Sua assinatura não permite acessar este conteúdo.');
      }
    }
    throw new NotFoundException('Conteúdo não encontrado.');
  }
}
