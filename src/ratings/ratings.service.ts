import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/utils/pagination';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { validatePersonalContentId, withPersonalTransaction } from '../common/utils/personal-resource';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { PutRatingDto } from './dto/put-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async put(contentId: number, user: AuthenticatedUser, dto: PutRatingDto) {
    validatePersonalContentId(contentId);
    return withPersonalTransaction(this.prisma, async (tx) => {
      await this.subscriptionAccess.requireAccessibleContent(contentId, user, tx);
      const data = { score: dto.score, comment: dto.comment ?? null };
      return tx.rating.upsert({
        where: { userId_contentId: { userId: user.id, contentId } },
        create: { userId: user.id, contentId, ...data },
        update: data,
      });
    });
  }

  async findMine(userId: number, pagination: PaginationQueryDto) {
    const where = { userId };
    return paginate(pagination, this.prisma.rating.count({ where }), (range) => this.prisma.rating.findMany({
      ...range,
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    }));
  }

  async findOne(contentId: number, userId: number) {
    validatePersonalContentId(contentId);
    const rating = await this.prisma.rating.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });
    if (!rating) throw new NotFoundException('Avaliação não encontrada.');
    return rating;
  }

  async aggregate(contentId: number, user: AuthenticatedUser) {
    validatePersonalContentId(contentId);
    return withPersonalTransaction(this.prisma, async (tx) => {
      await this.subscriptionAccess.requireAccessibleContent(contentId, user, tx);
      const result = await tx.rating.aggregate({
        where: { contentId, isActive: true },
        _avg: { score: true },
        _count: { _all: true },
      });
      return { average: result._avg.score, count: result._count._all };
    });
  }
}
