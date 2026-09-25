import { UserRole, UserStatus } from '../../generated/prisma/enums';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}