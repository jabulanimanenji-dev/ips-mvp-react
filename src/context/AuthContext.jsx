import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser, removeUser] = useLocalStorage('ips-user', null);
  const [admin, setAdmin, removeAdmin] = useLocalStorage('ips-admin-session', null);
  const [writer, setWriter, removeWriter] = useLocalStorage('ips-writer-session', null);

  // CLIENT LOGIN - calls API
  const loginClient = useCallback(async (email, password) => {
    try {
      const response = await fetch('/api/client/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.client);
        return { success: true };
      }
      return { success: false, error: data.message || 'Invalid credentials' };
    } catch (err) {
      return { success: false, error: 'Server error' };
    }
  }, [setUser]);

  // CLIENT SIGNUP - calls API
  const signupClient = useCallback(async (name, email, password) => {
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, email, password })
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.client);
        return { success: true };
      }
      return { success: false, error: data.message || 'Signup failed' };
    } catch (err) {
      return { success: false, error: 'Server error' };
    }
  }, [setUser]);

  // ADMIN LOGIN - calls API
  const loginAdmin = useCallback(async (email, password) => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        setAdmin({ email, name: 'Super Admin', role: data.role, token: data.token });
        return { success: true };
      }
      return { success: false, error: data.message || 'Invalid credentials' };
    } catch (err) {
      return { success: false, error: 'Server error' };
    }
  }, [setAdmin]);

  // WRITER LOGIN - calls API
  const loginWriter = useCallback(async (email, password) => {
    try {
      const response = await fetch('/api/writer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.success) {
        setWriter({ ...data.writer, token: data.token });
        return { success: true };
      }
      return { success: false, error: data.message || 'Invalid credentials' };
    } catch (err) {
      return { success: false, error: 'Server error' };
    }
  }, [setWriter]);

  const logout = useCallback(() => {
    removeUser();
    removeAdmin();
    removeWriter();
  }, [removeUser, removeAdmin, removeWriter]);

  return (
    <AuthContext.Provider value={{ user, admin, writer, loginClient, signupClient, loginAdmin, loginWriter, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);