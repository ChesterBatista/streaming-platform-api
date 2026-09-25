import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/utils/pagination';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { ContentStatus } from '../generated/prisma/enums';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { UpdateContentStatusDto } from './dto/update-content-status.dto';

@Injectable()
export class ContentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async create(dto: CreateContentDto) {
    try {
      return await this.prisma.content.create({
        data: {
          title: dto.title.trim(),
          type: dto.type,
          synopsis: dto.synopsis,
          releaseYear: dto.releaseYear,
          durationMinutes: dto.durationMinutes,
          externalId: dto.externalId,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe um conteúdo com este identificador externo.',
        );
      }

      throw error;
    }
  }

  async findAll(user: AuthenticatedUser, pagination: PaginationQueryDto) {
    const now = new Date();
    await this.subscriptionAccess.assertCanList(user, now);
    const where = this.subscriptionAccess.contentWhere(user, now);
    return paginate(pagination, this.prisma.content.count({ where }), (range) => this.prisma.content.findMany({
      ...range,
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }));
  }

  async findOne(id: number, user: AuthenticatedUser) {
    this.validateId(id);
    const content = await this.prisma.content.findFirst({
      where: { id, ...this.subscriptionAccess.contentWhere(user) },
    });

    if (!content) {
      return this.subscriptionAccess.throwContentReadError(id, user);
    }

    return content;
  }

  async update(id: number, dto: UpdateContentDto) {
    await this.requireContent(this.prisma, id);

    try {
      return await this.prisma.content.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.synopsis !== undefined && { synopsis: dto.synopsis }),
          ...(dto.releaseYear !== undefined && { releaseYear: dto.releaseYear }),
          ...(dto.durationMinutes !== undefined && {
            durationMinutes: dto.durationMinutes,
          }),
          ...(dto.externalId !== undefined && { externalId: dto.externalId }),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Já existe um conteúdo com este identificador externo.',
          );
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('Conteúdo não encontrado.');
        }
      }

      throw error;
    }
  }

  async updateStatus(id: number, dto: UpdateContentStatusDto) {
    return this.writeTransaction(async (tx) => {
      const content = await this.requireContent(tx, id);
      const transitions: Record<ContentStatus, ContentStatus[]> = {
        DRAFT: [ContentStatus.PUBLISHED, ContentStatus.ARCHIVED],
        PUBLISHED: [ContentStatus.ARCHIVED],
        ARCHIVED: [ContentStatus.DRAFT],
      };

      if (!transitions[content.status].includes(dto.status)) {
        throw new ConflictException('Transição de status incompatível com o estado atual.');
      }

      if (dto.status === ContentStatus.PUBLISHED) {
        const plans = await tx.planContent.count({ where: { contentId: id } });
        if (plans === 0) {
          throw new ConflictException('O conteúdo precisa de ao menos um plano para ser publicado.');
        }
      }

      return tx.content.update({
        where: { id },
        data: { status: dto.status },
      });
    });
  }

  async findPlans(id: number, user: AuthenticatedUser) {
    this.validateId(id);
    const content = await this.prisma.content.findFirst({
      where: { id, ...this.subscriptionAccess.contentWhere(user) },
      select: {
        plans: { orderBy: { planId: 'asc' }, select: { plan: true } },
      },
    });
    if (!content) {
      return this.subscriptionAccess.throwContentReadError(id, user);
    }
    return content.plans.map((link) => link.plan);
  }

  async findCategories(id: number, user: AuthenticatedUser) {
    this.validateId(id);
    const content = await this.prisma.content.findFirst({
      where: { id, ...this.subscriptionAccess.contentWhere(user) },
      select: {
        categories: { orderBy: { categoryId: 'asc' }, select: { category: true } },
      },
    });
    if (!content) {
      return this.subscriptionAccess.throwContentReadError(id, user);
    }
    return content.categories.map((link) => link.category);
  }

  async addPlan(id: number, planId: number) {
    return this.writeTransaction(async (tx) => {
      await this.requireContent(tx, id);
      await this.requirePlan(tx, planId);
      return tx.planContent.create({ data: { contentId: id, planId } });
    });
  }

  async removePlan(id: number, planId: number) {
    await this.writeTransaction(async (tx) => {
      const content = await this.requireContent(tx, id);
      await this.requirePlan(tx, planId);
      const where = { planId_contentId: { planId, contentId: id } };
      const link = await tx.planContent.findUnique({ where });
      if (!link) {
        throw new NotFoundException('Vínculo entre conteúdo e plano não encontrado.');
      }

      if (content.status === ContentStatus.PUBLISHED) {
        const plans = await tx.planContent.count({ where: { contentId: id } });
        if (plans <= 1) {
          throw new ConflictException('Não é possível remover o último plano de um conteúdo publicado.');
        }
      }

      await tx.planContent.delete({ where });
    });
  }

  async addCategory(id: number, categoryId: number) {
    return this.writeTransaction(async (tx) => {
      await this.requireContent(tx, id);
      await this.requireCategory(tx, categoryId);
      return tx.contentCategory.create({ data: { contentId: id, categoryId } });
    });
  }

  async removeCategory(id: number, categoryId: number) {
    await this.writeTransaction(async (tx) => {
      await this.requireContent(tx, id);
      await this.requireCategory(tx, categoryId);
      await tx.contentCategory.delete({
        where: { contentId_categoryId: { contentId: id, categoryId } },
      });
    });
  }

  private validateId(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('O ID deve ser um inteiro positivo de até 2147483647.');
    }
  }

  private async requireContent(tx: Prisma.TransactionClient, id: number) {
    this.validateId(id);
    const content = await tx.content.findUnique({ where: { id } });
    if (!content) {
      throw new NotFoundException('Conteúdo não encontrado.');
    }
    return content;
  }

  private async requirePlan(tx: Prisma.TransactionClient, id: number) {
    this.validateId(id);
    const plan = await tx.plan.findUnique({ where: { id }, select: { id: true } });
    if (!plan) {
      throw new NotFoundException('Plano não encontrado.');
    }
  }

  private async requireCategory(tx: Prisma.TransactionClient, id: number) {
    this.validateId(id);
    const category = await tx.category.findUnique({ where: { id }, select: { id: true } });
    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }
  }

  private async writeTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    // A publicação e a remoção de planos devem observar um estado consistente,
    // inclusive quando duas requisições tentam remover os últimos vínculos.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034') {
            if (attempt < 2) continue;
            throw new ConflictException('O recurso foi alterado simultaneamente. Tente novamente.');
          }
          if (error.code === 'P2002') {
            throw new ConflictException('Este vínculo já existe.');
          }
          if (error.code === 'P2003' || error.code === 'P2025') {
            throw new NotFoundException('Conteúdo, recurso relacionado ou vínculo não encontrado.');
          }
        }
        throw error;
      }
    }
    throw new ConflictException('Não foi possível concluir a operação devido a alterações simultâneas.');
  }
}
