import { api, setToken, clearAuth, type User } from './api';

export type { User };

export function getUser(): User | null {
  const data = localStorage.getItem('dd_user');
  return data ? JSON.parse(data) : null;
}

export function saveUser(user: User, token: string) {
  localStorage.setItem('dd_user', JSON.stringify(user));
  setToken(token);
}

export async function loginAsync(username: string, password: string): Promise<User> {
  const res = await api.auth.login(username, password);
  saveUser(res.user, res.token);
  return res.user;
}

export async function registerAsync(username: string, email: string, password: string, full_name?: string): Promise<User> {
  const res = await api.auth.register(username, email, password, full_name);
  saveUser(res.user, res.token);
  return res.user;
}

export function logout() {
  clearAuth();
}

export function isAuthenticated(): boolean {
  return !!(localStorage.getItem('dd_token') && localStorage.getItem('dd_user'));
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'admin';
}
