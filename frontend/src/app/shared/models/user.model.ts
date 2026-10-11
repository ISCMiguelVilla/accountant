import { Language } from '../../core/i18n/language';
import { Role } from '../enums/role.enum';
import { UserStatus } from '../enums/user-status.enum';

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  status: UserStatus;
  preferredLanguage: Language;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateRequest {
  name: string;
  status: UserStatus;
}
