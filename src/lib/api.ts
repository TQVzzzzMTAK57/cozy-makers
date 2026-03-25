const BASE_URL = '/api';

export function getToken(): string | null {
  return localStorage.getItem('dd_token');
}
export function setToken(token: string) {
  localStorage.setItem('dd_token', token);
}
export function clearAuth() {
  localStorage.removeItem('dd_token');
  localStorage.removeItem('dd_user');
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { message?: string }).message || 'Request failed', res.status);
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  full_name: string;
  created_at: string;
  drone_count?: number;
  prediction_count?: number;
}

export interface DroneAPI {
  id: number;
  user_id: number;
  name: string;
  serial_number: string;
  model: string;
  firmware_version: string;
  status: 'Idle' | 'Active' | 'Maintenance' | 'Offline';
  created_at: string;
  // admin fields
  owner_username?: string;
  owner_email?: string;
  prediction_count?: number;
}

export interface PredictionAPI {
  id: number;
  drone_id: number;
  user_id: number;
  name: string;
  uploaded_at: string;
  media_type: 'image' | 'video';
  file_url: string | null;
  video_url: string | null;   // legacy alias for file_url
  result_url: string | null;  // annotated output from YOLO
  has_result: boolean;
  detections: { label: string; confidence: number; x: number; y: number; width?: number; height?: number }[];
  frame_results?: { frame: number; detections: unknown[] }[];
  elapsed_seconds?: number;
  feedback_accurate: boolean | null;
  feedback_comment: string | null;
  // admin fields
  drone_name?: string;
  username?: string;
}

export interface AlertAPI {
  id: number;
  prediction_id: number;
  drone_id: number;
  user_id: number;
  type: string;
  severity: 'HIGH' | 'CRITICAL';
  message: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  drone_name?: string;
  username?: string;
}

export interface AdminStats {
  users: { total: number; admins: number; active: number; inactive: number };
  drones: { total: number; byStatus: Record<string, number> };
  predictions: { total: number; withFeedback: number };
  alerts: { total: number; unresolved: number };
  recentActivity: (PredictionAPI & { drone_name: string; username: string })[];
}

// ─── API ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    register: (username: string, email: string, password: string, full_name?: string) =>
      request<{ token: string; user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password, full_name }) }),
    me: () => request<User>('/auth/me'),
    updateProfile: (full_name: string) =>
      request<User>('/auth/profile', { method: 'PUT', body: JSON.stringify({ full_name }) }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean }>('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  drones: {
    list: () => request<DroneAPI[]>('/drones'),
    get: (id: number) => request<DroneAPI>(`/drones/${id}`),
    create: (data: { name: string; serialNumber: string; model: string; firmwareVersion: string; status: string }) =>
      request<DroneAPI>('/drones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; serialNumber: string; model: string; firmwareVersion: string; status: string }>) =>
      request<DroneAPI>(`/drones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: number) => request<{ success: boolean }>(`/drones/${id}`, { method: 'DELETE' }),
  },

  predictions: {
    list: (droneId: number) => request<PredictionAPI[]>(`/predictions?droneId=${droneId}`),
    get: (id: number) => request<PredictionAPI>(`/predictions/${id}`),
    upload: (droneId: number, file: File, onProgress?: (pct: number) => void, conf?: number) =>
      new Promise<PredictionAPI>((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);           // backend now accepts 'file'
        fd.append('droneId', String(droneId));
        fd.append('name', file.name);
        if (conf !== undefined) fd.append('conf', String(conf));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${BASE_URL}/predictions/upload`);
        const token = getToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        });
        xhr.addEventListener('load', () => {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data as PredictionAPI);
          else reject(new ApiError(data.message || 'Upload failed', xhr.status));
        });
        xhr.addEventListener('error', () => reject(new ApiError('Network error', 0)));
        xhr.send(fd);
      }),
    feedback: (id: number, accurate: boolean, comment: string) =>
      request<{ success: boolean }>(`/predictions/${id}/feedback`, { method: 'POST', body: JSON.stringify({ accurate, comment }) }),
    delete: (id: number) => request<{ success: boolean }>(`/predictions/${id}`, { method: 'DELETE' }),
  },

  alerts: {
    list: () => request<AlertAPI[]>('/alerts'),
    resolve: (id: number) => request<{ success: boolean }>(`/alerts/${id}/resolve`, { method: 'PUT' }),
  },

  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    users: {
      list: () => request<User[]>('/admin/users'),
      setRole: (id: number, role: 'admin' | 'user') =>
        request<User>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
      setStatus: (id: number, is_active: boolean) =>
        request<User>(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ is_active }) }),
      delete: (id: number) => request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
    },
    drones: { list: () => request<DroneAPI[]>('/admin/drones') },
    predictions: { list: () => request<PredictionAPI[]>('/admin/predictions') },
    alerts: {
      list: () => request<AlertAPI[]>('/admin/alerts'),
      resolve: (id: number) => request<{ success: boolean }>(`/admin/alerts/${id}/resolve`, { method: 'PUT' }),
    },
  },
};
