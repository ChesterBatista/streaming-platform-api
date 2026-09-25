import {
  BadRequestException, FileTypeValidator, Injectable, InternalServerErrorException,
  NotFoundException, StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { validatePersonalContentId } from '../common/utils/personal-resource';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionAccessService } from '../subscriptions/subscription-access.service';
import { THUMBNAIL_FILENAME, THUMBNAIL_MAX_BYTES, THUMBNAIL_URL_PREFIX } from './thumbnail.constants';

@Injectable()
export class UploadsService {
  private readonly directory = resolve(process.cwd(), 'uploads', 'thumbnails');

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async uploadThumbnail(id: number, file: Express.Multer.File | undefined) {
    validatePersonalContentId(id);
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Envie uma imagem no campo file.');
    }
    if (file.buffer.length > THUMBNAIL_MAX_BYTES) {
      throw new BadRequestException('A thumbnail deve ter no máximo 5 MiB.');
    }
    const extension = extname(file.originalname).toLowerCase();
    const jpeg = file.mimetype === 'image/jpeg' && ['.jpg', '.jpeg'].includes(extension);
    const png = file.mimetype === 'image/png' && extension === '.png';
    if ((!jpeg && !png) || !(await new FileTypeValidator({
      fileType: file.mimetype,
    }).isValid(file))) {
      throw new BadRequestException('A thumbnail deve ser JPEG ou PNG, com MIME, extensão e assinatura binária compatíveis.');
    }

    const content = await this.prisma.content.findUnique({ where: { id }, select: { id: true } });
    if (!content) throw new NotFoundException('Conteúdo não encontrado.');

    const filename = `${randomUUID()}.${jpeg ? 'jpg' : 'png'}`;
    const thumbnailUrl = `${THUMBNAIL_URL_PREFIX}${filename}`;
    try {
      await mkdir(this.directory, { recursive: true });
      await writeFile(join(this.directory, filename), file.buffer, { flag: 'wx', mode: 0o600 });
    } catch {
      throw new InternalServerErrorException('Não foi possível armazenar a thumbnail.');
    }

    try {
      return await this.prisma.content.update({
        where: { id },
        data: { thumbnailUrl },
        select: { id: true, thumbnailUrl: true },
      });
    } catch (error: unknown) {
      // Não remover arquivos após erro de comunicação: a atualização pode ter
      // sido confirmada no banco. Arquivos sem referência não são servidos.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Conteúdo não encontrado.');
      }
      throw new InternalServerErrorException('Não foi possível vincular a thumbnail ao conteúdo.');
    }
  }

  async readThumbnail(filename: string, user: AuthenticatedUser) {
    if (!THUMBNAIL_FILENAME.test(filename)) {
      throw new BadRequestException('Nome de thumbnail inválido.');
    }
    const thumbnailUrl = `${THUMBNAIL_URL_PREFIX}${filename}`;
    const content = await this.prisma.content.findFirst({
      where: { thumbnailUrl, ...this.subscriptionAccess.contentWhere(user) },
      select: { id: true },
    });
    if (!content) {
      const linked = await this.prisma.content.findFirst({
        where: { thumbnailUrl }, select: { id: true },
      });
      if (linked) return this.subscriptionAccess.throwContentReadError(linked.id, user);
      throw new NotFoundException('Thumbnail não encontrada.');
    }

    try {
      const path = join(this.directory, filename);
      const info = await lstat(path);
      const root = await realpath(this.directory);
      const resolved = await realpath(path);
      if (!info.isFile() || info.isSymbolicLink() || dirname(resolved) !== root || info.size > THUMBNAIL_MAX_BYTES) {
        throw new NotFoundException('Thumbnail não encontrada.');
      }
      const buffer = await readFile(resolved);
      return new StreamableFile(buffer, {
        type: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
        length: buffer.length,
        disposition: `inline; filename="${filename}"`,
      });
    } catch (error: unknown) {
      if (error instanceof NotFoundException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        throw new NotFoundException('Thumbnail não encontrada.');
      }
      throw new InternalServerErrorException('Não foi possível ler a thumbnail.');
    }
  }
}
