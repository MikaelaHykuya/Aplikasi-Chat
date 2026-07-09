import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth as authApi, setToken, removeToken } from '../services/api';
import { getToken, setUser as saveUser, getUser as loadUserData, removeUser as clearUserData } from '../services/storage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const userData = await loadUserData();
      if (userData) {
        setUser(userData);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const result = await authApi.login(username, password);
    await setToken(result.token);
    await saveUser(result.user);
    setUser(result.user);
    return result;
  }

  async function register(username, email, password, displayName) {
    const result = await authApi.register(username, email, password, displayName);
    await setToken(result.token);
    await saveUser(result.user);
    setUser(result.user);
    return result;
  }

  async function logout() {
    await removeToken();
    await clearUserData();
    setUser(null);
  }

  async function updateUser(data) {
    const updated = { ...user, ...data };
    await saveUser(updated);
    setUser(updated);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
