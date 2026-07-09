import AsyncStorage from '@react-native-async-storage/async-storage';

const store = {};

export async function getToken() {
  return store.token || null;
}

export async function setToken(token) {
  store.token = token;
}

export async function removeToken() {
  delete store.token;
}

export async function getUser() {
  return store.user || null;
}

export async function setUser(user) {
  store.user = user;
}

export async function removeUser() {
  delete store.user;
}

export async function setStorage(key, value) {
  store[key] = value;
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export async function getStorage(key) {
  if (key in store) return store[key];
  try {
    const val = await AsyncStorage.getItem(key);
    if (val) { store[key] = JSON.parse(val); return store[key]; }
  } catch {}
  return null;
}

export async function removeStorage(key) {
  delete store[key];
  try { await AsyncStorage.removeItem(key); } catch {}
}

let settingsCache = null;
const settingsListeners = new Set();
export function onSettingsChange(fn) { settingsListeners.add(fn); return () => settingsListeners.delete(fn); }
export function getCachedSettings() { return settingsCache; }
export async function updateCachedSettings(updates) {
  settingsCache = { ...(settingsCache || {}), ...updates };
  for (const fn of settingsListeners) fn(settingsCache);
}
