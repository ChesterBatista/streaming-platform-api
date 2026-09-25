import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export function validatePersonalContentId(id: number): void {
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new BadRequestException('O ID do conteúdo deve ser um inteiro positivo de até 2147483647.');
  }
}

export async function withPersonalTransaction<T>(
  prisma: PrismaService,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Repetir a transação permite ao upsert encontrar um registro criado
        // simultaneamente, sem transformar uma segunda gravação em duplicidade.
        if (error.code === 'P2034' || error.code === 'P2002') {
          if (attempt < 2) continue;
          throw new ConflictException('Não foi possível concluir devido a alterações simultâneas. Tente novamente.');
        }
        if (error.code === 'P2003' || error.code === 'P2025') {
          throw new NotFoundException('Usuário, conteúdo ou registro pessoal não encontrado.');
        }
      }
      throw error;
    }
  }
  throw new ConflictException('Não foi possível concluir devido a alterações simultâneas.');
}
