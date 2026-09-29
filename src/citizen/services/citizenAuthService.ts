/**
 * citizenAuthService.ts
 *
 * Handles citizen authentication against FastAPI.
 * Swap the DEV_MOCK adapter for a real apiRequest call once the backend is ready.
 */

import { setAuthToken } from '../../api/client';
import { apiRequest } from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import type { CitizenSession } from '../types';

// ---------------------------------------------------------------------------
// TEMPORARY DEV ADAPTER — remove when /auth/login is live
// ---------------------------------------------------------------------------
const DEV_MODE = !process.env.EXPO_PUBLIC_API_URL;

const DEV_CREDENTIALS: Record<string, CitizenSession> = {
  'citizen@rhi.dev': {
    userId: 'DEV-001',
    token: 'dev-token-citizen',
    email: 'citizen@rhi.dev',
    displayName: 'Dev Citizen',
  },
};

async function devLogin(email: string, _password: string): Promise<CitizenSession> {
  await new Promise((r) => setTimeout(r, 800)); // simulate network
  const session = DEV_CREDENTIALS[email.toLowerCase().trim()];
  if (!session) {
    throw new Error('Invalid credentials. (Dev mode: use citizen@rhi.dev)');
  }
  return session;
}
// ---------------------------------------------------------------------------

export interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  display_name: string;
}

/**
 * Authenticate citizen. On success, stores token in the shared API client.
 * Replace `devLogin` with `realLogin` once the backend endpoint is ready.
 */
export async function citizenLogin(credentials: LoginCredentials): Promise<CitizenSession> {
  if (DEV_MODE) {
    const session = await devLogin(credentials.email, credentials.password);
    setAuthToken(session.token);
    return session;
  }
  return realLogin(credentials);
}

async function realLogin(credentials: LoginCredentials): Promise<CitizenSession> {
  const body = new URLSearchParams({
    username: credentials.email,
    password: credentials.password,
  });
  const resp = await apiRequest<LoginResponse>(ENDPOINTS.login, {
    method: 'POST',
    body: body as unknown as Record<string, unknown>,
  });
  const session: CitizenSession = {
    userId: resp.user_id,
    token: resp.access_token,
    email: resp.email,
    displayName: resp.display_name,
  };
  setAuthToken(session.token);
  return session;
}

export function citizenLogout(): void {
  setAuthToken(null);
}
