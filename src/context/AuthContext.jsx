import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser, removeUser] = useLocalStorage('ips-user', null);
  const [admin, setAdmin, removeAdmin] = useLocalStorage('ips-admin-session', null);
  const [writer, setWriter, removeWriter] = useLocalStorage('ips-writer-session', null);

  const loginClient = useCallback((email, password) => {
  const clients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
  const client = clients.find(c => c.email === email && c.password === password);
  if (client) {
    setUser({ ...client, email: client.email });
    return { success: true };
  }
  return { success: false, error: 'Invalid email or password' };
}, [setUser]);

  const signupClient = useCallback((name, email, password) => {
  const clients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
  const newId = `CID-${String(clients.length + 1).padStart(3, '0')}`;
  const newClient = {
    client_id: newId,
    full_name: name,
    email,
    password, // ← STORE PASSWORD (encrypted in production)
    phone: '',
    country: '',
    registration_date: new Date().toISOString().split('T')[0],
    total_orders: 0,
    total_spent: 0,
    status: 'Active',
    notes: ''
  };
  clients.push(newClient);
  localStorage.setItem('ips-clients', JSON.stringify(clients));
  setUser({ ...newClient, email });
  return { success: true };
}, [setUser]);

  // ─── SECURE ADMIN LOGIN ───
  const loginAdmin = useCallback(async (email, password) => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const session = { email, name: 'Super Admin', role: data.role || 'superadmin', token: data.token };
        setAdmin(session);
        return { success: true };
      } else {
        return { success: false, error: data.message || 'Invalid credentials' };
      }
    } catch (err) {
      console.error('Admin login error:', err);
      return { success: false, error: 'Server error. Please try again.' };
    }
  }, [setAdmin]);

  // ─── WRITER LOGIN ───
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
      } else {
        return { success: false, error: data.message || 'Invalid credentials' };
      }
    } catch (err) {
      console.error('Writer login error:', err);
      return { success: false, error: 'Server error. Please try again.' };
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