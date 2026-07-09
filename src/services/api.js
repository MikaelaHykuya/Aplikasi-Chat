import { fromByteArray } from 'base64-js';
import { getToken, setToken as storeToken, removeToken as clearToken, updateCachedSettings, getCachedSettings } from './storage';
import { API_URL } from '../config/api';

export { storeToken as setToken, clearToken as removeToken };

async function request(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

export const auth = {
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username, email, password, displayName) =>
    request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, displayName }),
    }),
};

export const users = {
  getProfile: () => request('/api/users/profile'),
  updateProfile: (data) =>
    request('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getById: (id) => request(`/api/users/${id}`),
  search: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  getFriends: () => request('/api/users/friends'),
  sendFriendRequest: (toUserId) =>
    request('/api/users/friend-request', {
      method: 'POST',
      body: JSON.stringify({ toUserId }),
    }),
  getFriendRequests: () => request('/api/users/friend-requests'),
  respondFriendRequest: (id, action) =>
    request(`/api/users/friend-request/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  blockUser: (id) =>
    request(`/api/users/${id}/block`, { method: 'POST' }),
  unblockUser: (id) =>
    request(`/api/users/${id}/unblock`, { method: 'POST' }),
};

export const chats = {
  getAll: () => request('/api/chats'),
  getById: (id) => request(`/api/chats/${id}`),
  getMessages: (chatId, { limit = 50, before } = {}) => {
    let url = `/api/chats/${chatId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return request(url);
  },
  createGroup: (name, memberIds) =>
    request('/api/chats/group', {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    }),
  markRead: (chatId, messageIds) =>
    request(`/api/chats/${chatId}/read`, {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    }),
  archive: (chatId, archived) =>
    request(`/api/chats/${chatId}/archive`, {
      method: 'PUT',
      body: JSON.stringify({ archived }),
    }),
  backup: (chatId) => request(`/api/chats/${chatId}/backup`),
  restore: (chatId, messages) =>
    request(`/api/chats/${chatId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
};

export const upload = {
  file: async (fileUri, fileName, mimeType) => {
    const token = await getToken();
    let base64;
    try {
      const { File } = await import('expo-file-system');
      const file = new File(fileUri);
      const buf = await file.arrayBuffer();
      base64 = fromByteArray(new Uint8Array(buf));
    } catch (_) {
      const resp = await fetch(fileUri);
      const buf = await resp.arrayBuffer();
      base64 = fromByteArray(new Uint8Array(buf));
    }
    const res = await fetch(`${API_URL}/api/upload/base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: `data:${mimeType};base64,${base64}`, fileName, mimeType }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Upload gagal');
    return result;
  },
};

export const updateAvatar = async (avatar) =>
  request('/api/users/avatar', { method: 'PUT', body: JSON.stringify({ avatar }) });

export const deleteMessage = async (chatId, messageId, deleteForEveryone) =>
  request(`/api/chats/${chatId}/messages/${messageId}`, {
    method: 'DELETE',
    body: JSON.stringify({ deleteForEveryone }),
  });

export const addGroupMembers = async (chatId, userIds) =>
  request(`/api/chats/${chatId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  });

export const removeGroupMember = async (chatId, userId) =>
  request(`/api/chats/${chatId}/members/${userId}`, { method: 'DELETE' });

export const deleteGroup = async (chatId) =>
  request(`/api/chats/${chatId}`, { method: 'DELETE' });

export const updateGroupName = async (chatId, name) =>
  request(`/api/chats/${chatId}/name`, { method: 'PUT', body: JSON.stringify({ name }) });

export const updateGroupSettings = async (chatId, settings) =>
  request(`/api/chats/${chatId}/settings`, { method: 'PUT', body: JSON.stringify(settings) });

export const updateMemberRole = async (chatId, userId, role) =>
  request(`/api/chats/${chatId}/members/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });

export const updateGroupAvatar = async (chatId, avatar) =>
  request(`/api/chats/${chatId}/avatar`, { method: 'PUT', body: JSON.stringify({ avatar }) });

export const getSettings = async () => {
  const cached = getCachedSettings();
  if (cached) return cached;
  const fresh = await request('/api/users/settings');
  await updateCachedSettings(fresh);
  return fresh;
};

export const updateSettings = async (settings) => {
  await updateCachedSettings(settings);
  return request('/api/users/settings', { method: 'PUT', body: JSON.stringify(settings) });
};

export const deleteAccount = () =>
  request('/api/users/account', { method: 'DELETE' });

export const backup = {
  getBackup: () => request('/api/backup'),
  restoreBackup: (data) => request('/api/backup', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};
