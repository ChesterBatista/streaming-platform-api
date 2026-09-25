
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/utils/pagination';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { UpdatePlanStatusDto } from './dto/update-plan-status.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  private handleWriteError(error: unknown): never {
    const code =
      typeof error === 'object' &&
      error !== null &&
      'code' in error
        ? error.code
        : undefined;

    if (code === 'P2002') {
      throw new ConflictException(
        'Já existe um plano com este nome.',
      );
    }

    if (code === 'P2025') {
      throw new NotFoundException('Plano não encontrado.');
    }

    throw error;
  }

  async create(dto: CreatePlanDto) {
    const normalizedName = dto.name.trim();

    if (!normalizedName) {
      throw new BadRequestException(
        'O nome do plano não pode estar vazio.',
      );
    }

    const existingPlan = await this.prisma.plan.findUnique({
      where: {
        name: normalizedName,
      },
    });

    if (existingPlan) {
      throw new ConflictException(
        'Já existe um plano com este nome.',
      );
    }

    try {
      return await this.prisma.plan.create({
        data: {
          name: normalizedName,
          description: dto.description?.trim() || null,
          price: dto.price,
        },
      });
    } catch (error) {
      return this.handleWriteError(error);
    }
  }

  async findAll(pagination: PaginationQueryDto) {
    const where = {};

    return paginate(
      pagination,
      this.prisma.plan.count({ where }),
      (range) =>
        this.prisma.plan.findMany({
          ...range,
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
    );
  }

  async findOne(id: number) {
    const plan = await this.prisma.plan.findUnique({
      where: {
        id,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado.');
    }

    return plan;
  }

  async update(id: number, dto: UpdatePlanDto) {
    const plan = await this.findOne(id);

    let normalizedName: string | undefined;

    if (dto.name !== undefined) {
      normalizedName = dto.name.trim();

      if (!normalizedName) {
        throw new BadRequestException(
          'O nome do plano não pode estar vazio.',
        );
      }

      const existingPlan = await this.prisma.plan.findUnique({
        where: {
          name: normalizedName,
        },
      });

      if (existingPlan && existingPlan.id !== plan.id) {
        throw new ConflictException(
          'Já existe um plano com este nome.',
        );
      }
    }

    try {
      return await this.prisma.plan.update({
        where: {
          id,
        },
        data: {
          ...(normalizedName !== undefined && {
            name: normalizedName,
          }),

          ...(dto.description !== undefined && {
            description: dto.description?.trim() || null,
          }),

          ...(dto.price !== undefined && {
            price: dto.price,
          }),
        },
      });
    } catch (error) {
      return this.handleWriteError(error);
    }
  }

  async updateStatus(
    id: number,
    dto: UpdatePlanStatusDto,
  ) {
    await this.findOne(id);

    try {
      return await this.prisma.plan.update({
        where: {
          id,
        },
        data: {
          status: dto.status,
        },
      });
    } catch (error) {
      return this.handleWriteError(error);
    }
  }
}