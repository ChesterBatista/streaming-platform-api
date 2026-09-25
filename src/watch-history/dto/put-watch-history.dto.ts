import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class PutWatchHistoryDto {
  @ApiProperty({
    description: 'Posição em segundos; não pode ultrapassar a duração do conteúdo quando informada.',
    example: 120,
    type: 'integer',
    minimum: 0,
    maximum: 2147483647,
  })
  @IsInt({ message: 'O progresso em segundos deve ser um número inteiro.' })
  @Min(0, { message: 'O progresso em segundos não pode ser negativo.' })
  @Max(2147483647, { message: 'O progresso está fora do intervalo permitido pelo banco.' })
  progressSeconds!: number;

  @ApiProperty({
    description: 'Indica explicitamente se a reprodução foi concluída; não é inferido do progresso.',
    example: false,
    type: 'boolean',
  })
  @IsBoolean({ message: 'O campo completed deve ser um booleano.' })
  completed!: boolean;
}
