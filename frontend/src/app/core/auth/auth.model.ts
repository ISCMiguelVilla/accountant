import { Language } from '../i18n/language';
import { User } from '../../shared/models/user.model';

export interface SignInRequest {
  username: string;
  password: string;
}

export interface SignUpRequest {
  name: string;
  username: string;
  password: string;
  preferredLanguage: Language;
}

export interface AuthResponse {
  token: string;
  /** ISO-8601 instant. */
  expiresAt: string;
  user: User;
}

/** What is kept in localStorage between page loads. */
export interface Session {
  token: string;
  expiresAt: string;
  user: User;
}
