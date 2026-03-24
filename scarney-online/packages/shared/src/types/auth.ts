export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatarEmoji: string;
  chips: number;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}
