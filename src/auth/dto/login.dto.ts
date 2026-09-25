import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail cadastrado do usuário.',
    example: 'usuario@streaming.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Senha do usuário.',
    example: 'Senha@123',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}