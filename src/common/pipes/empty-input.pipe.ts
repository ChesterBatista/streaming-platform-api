import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class EmptyInputPipe implements PipeTransform {
  transform(value: unknown) {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0) {
      throw new BadRequestException('Esta operação não aceita campos neste body ou query.');
    }
    return value;
  }
}
