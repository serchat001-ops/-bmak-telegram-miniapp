import React, { useState, useEffect, ReactNode } from 'react';
import { AuthContext, User, Config } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';
import { getWebUid, setWebUid, clearWebUid } from '@/lib/storage';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [webUid, setWebUidState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initSession();
  }, []);

  async function initSession() {
    try {
      const cfg = await apiFetch('/api/config');
      setConfig(cfg);
    } catch (e) {}

    try {
      const saved = await getWebUid();
      if (saved) {
        const data = await apiFetch('/api/users/web-session', 'POST', { webUid: saved });
        if (data.user) {
          setUser(data.user);
          setWebUidState(saved);
        } else {
          await clearWebUid();
        }
      }
    } catch (e) {
      await clearWebUid();
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const data = await apiFetch('/api/users/web-login', 'POST', { email, password });
    if (data.user && data.webUid) {
      await setWebUid(data.webUid);
      setUser(data.user);
      setWebUidState(data.webUid);
    }
  }

  async function register(email: string, displayName: string, password: string, refCode = '') {
    const data = await apiFetch('/api/users/web-register', 'POST', {
      email,
      displayName,
      password,
      referralCode: refCode,
    });
    if (data.user && data.webUid) {
      await setWebUid(data.webUid);
      setUser(data.user);
      setWebUidState(data.webUid);
    }
  }

  async function logout() {
    await clearWebUid();
    setUser(null);
    setWebUidState(null);
  }

  function updateUser(u: User) {
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, config, webUid, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
