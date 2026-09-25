import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { paginate } from '../common/utils/pagination';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const normalizedName = dto.name.trim();

    const existingCategory = await this.prisma.category.findUnique({
      where: {
        name: normalizedName,
      },
    });

    if (existingCategory) {
      throw new ConflictException('Já existe uma categoria com este nome.');
    }

    try {
      return await this.prisma.category.create({
        data: {
          name: normalizedName,
          description: dto.description?.trim() || null,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma categoria com este nome.');
      }

      throw error;
    }
  }

  async findAll(pagination: PaginationQueryDto) {
    const where = {};
    return paginate(pagination, this.prisma.category.count({ where }), (range) => this.prisma.category.findMany({
      ...range,
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }));
  }

  async findOne(id: number) {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new BadRequestException('O ID da categoria deve ser um inteiro positivo de até 2147483647.');
    }
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    if (dto.name !== undefined) {
      const normalizedName = dto.name.trim();

      const existingCategory = await this.prisma.category.findUnique({
        where: {
          name: normalizedName,
        },
      });

      if (existingCategory && existingCategory.id !== category.id) {
        throw new ConflictException('Já existe uma categoria com este nome.');
      }
    }

    try {
      return await this.prisma.category.update({
        where: {
          id,
        },
        data: {
          ...(dto.name !== undefined && {
            name: dto.name.trim(),
          }),
          ...(dto.description !== undefined && {
            description: dto.description?.trim() || null,
          }),
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Já existe uma categoria com este nome.');
        }

        if (error.code === 'P2025') {
          throw new NotFoundException('Categoria não encontrada.');
        }
      }

      throw error;
    }
  }
}
