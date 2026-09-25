import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário.',
    example: 'João da Silva',
    minLength: 3,
    maxLength: 120,
  })
  @IsString()
  @MinLength(3)
  @Matches(/\S/, {
  message: 'O nome deve conter pelo menos um caractere que não seja espaço.',
  })
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'E-mail utilizado para acesso à plataforma.',
    example: 'joao.silva@streaming.com',
    maxLength: 180,
  })
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @ApiProperty({
    description:
      'Senha do usuário. Deve possuir entre 8 e 72 caracteres.',
    example: 'Senha@123',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}