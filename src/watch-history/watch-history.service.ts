import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/utils/pagination';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { validatePersonalContentId, withPersonalTransaction } from '../common/utils/personal-resource';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { PutWatchHistoryDto } from './dto/put-watch-history.dto';

@Injectable()
export class WatchHistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async put(contentId: number, user: AuthenticatedUser, dto: PutWatchHistoryDto) {
    validatePersonalContentId(contentId);
    return withPersonalTransaction(this.prisma, async (tx) => {
      const content = await this.subscriptionAccess.requireAccessibleContent(contentId, user, tx);
      if (content.durationMinutes !== null && dto.progressSeconds > content.durationMinutes * 60) {
        throw new BadRequestException('O progresso em segundos não pode ultrapassar a duração do conteúdo.');
      }

      const data = {
        progressSeconds: dto.progressSeconds,
        completed: dto.completed,
        lastWatchedAt: new Date(),
      };
      return tx.watchHistory.upsert({
        where: { userId_contentId: { userId: user.id, contentId } },
        create: { userId: user.id, contentId, ...data },
        update: data,
      });
    });
  }

  async findMine(userId: number, pagination: PaginationQueryDto) {
    const where = { userId };
    return paginate(pagination, this.prisma.watchHistory.count({ where }), (range) => this.prisma.watchHistory.findMany({
      ...range,
      where,
      orderBy: [{ lastWatchedAt: 'desc' }, { id: 'desc' }],
    }));
  }

  async findOne(contentId: number, userId: number) {
    validatePersonalContentId(contentId);
    const history = await this.prisma.watchHistory.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });
    if (!history) throw new NotFoundException('Histórico não encontrado.');
    return history;
  }
}
