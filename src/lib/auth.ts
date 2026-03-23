export interface User {
  id: number;
  username: string;
  email: string;
}

export function getUser(): User | null {
  const data = localStorage.getItem('dd_user');
  return data ? JSON.parse(data) : null;
}

export function login(username: string, password: string): User | null {
  // Mock login
  if (username && password) {
    const user: User = { id: 1, username, email: `${username}@gmail.com` };
    localStorage.setItem('dd_user', JSON.stringify(user));
    return user;
  }
  return null;
}

export function logout() {
  localStorage.removeItem('dd_user');
}

export function isAuthenticated(): boolean {
  return !!getUser();
}
