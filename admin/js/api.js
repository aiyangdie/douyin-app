/**
 * API client for the admin console.
 *
 * Holds the bearer token in localStorage and normalises every failure into an
 * `ApiError` with a human-readable Chinese message, so views never have to
 * inspect status codes themselves. A 401 anywhere drops the session and bounces
 * to the login screen.
 */
const TOKEN_KEY = 'douyin-admin-token';
const ADMIN_KEY = 'douyin-admin-profile';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get admin() {
    try {
      return JSON.parse(localStorage.getItem(ADMIN_KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  save(token, admin) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  },
};

/** Set by app.js so a 401 can return the user to the login screen. */
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

async function request(method, path, { body, form } = {}) {
  const headers = {};
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let payload;
  if (form) {
    payload = form; // FormData sets its own Content-Type with the boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new ApiError('无法连接服务器，请确认服务已启动', 0);
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* a non-JSON body only matters for the error message below */
  }

  if (response.status === 401) {
    session.clear();
    onUnauthorized();
    throw new ApiError(json?.error?.message ?? '登录已过期，请重新登录', 401);
  }

  if (!response.ok) {
    throw new ApiError(json?.error?.message ?? `请求失败（HTTP ${response.status}）`, response.status);
  }

  return json;
}

const qs = (params = {}) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};

export const api = {
  health: () => request('GET', '/api/health'),

  async login(username, password) {
    const result = await request('POST', '/api/auth/login', { body: { username, password } });
    session.save(result.token, result.admin);
    return result.admin;
  },
  logout: () => request('POST', '/api/auth/logout').catch(() => null),
  me: () => request('GET', '/api/auth/me'),

  overview: (params) => request('GET', `/api/stats/overview${qs(params)}`),
  pendingQueue: () => request('GET', '/api/stats/pending'),

  users: {
    list: (params) => request('GET', `/api/users${qs(params)}`),
    get: (id) => request('GET', `/api/users/${encodeURIComponent(id)}`),
    update: (id, patch) => request('PATCH', `/api/users/${encodeURIComponent(id)}`, { body: patch }),
    remove: (id) => request('DELETE', `/api/users/${encodeURIComponent(id)}`),
  },

  videos: {
    list: (params) => request('GET', `/api/videos${qs(params)}`),
    get: (id) => request('GET', `/api/videos/${encodeURIComponent(id)}`),
    update: (id, patch) => request('PATCH', `/api/videos/${encodeURIComponent(id)}`, { body: patch }),
    remove: (id) => request('DELETE', `/api/videos/${encodeURIComponent(id)}`),
    bulk: (ids, action, reason) => request('POST', '/api/videos/bulk', { body: { ids, action, reason } }),
  },

  comments: {
    list: (params) => request('GET', `/api/comments${qs(params)}`),
    update: (id, status) => request('PATCH', `/api/comments/${encodeURIComponent(id)}`, { body: { status } }),
    remove: (id) => request('DELETE', `/api/comments/${encodeURIComponent(id)}`),
  },

  logs: {
    list: (params) => request('GET', `/api/logs${qs(params)}`),
  },
};
