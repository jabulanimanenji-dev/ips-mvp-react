import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ADMIN_CREDENTIALS } from '../utils/constants';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser, removeUser] = useLocalStorage('ips-user', null);
  const [admin, setAdmin, removeAdmin] = useLocalStorage('ips-admin-session', null);

  const loginClient = useCallback((email) => {
    const clients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
    const client = clients.find(c => c.email === email);
    if (client) {
      setUser({ ...client, email: client.email });
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  }, [setUser]);

  const signupClient = useCallback((name, email) => {
    const clients = JSON.parse(localStorage.getItem('ips-clients') || '[]');
    const newId = `CID-${String(clients.length + 1).padStart(3, '0')}`;
    const newClient = {
      client_id: newId, full_name: name, email,
      phone: '', country: '', registration_date: new Date().toISOString().split('T')[0],
      total_orders: 0, total_spent: 0, status: 'Active', notes: ''
    };
    clients.push(newClient);
    localStorage.setItem('ips-clients', JSON.stringify(clients));
    setUser({ ...newClient, email });
    return { success: true };
  }, [setUser]);

  const loginAdmin = useCallback((email, password) => {
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      const session = { email, name: 'Super Admin', role: 'superadmin' };
      setAdmin(session);
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  }, [setAdmin]);

  const logout = useCallback(() => {
    removeUser();
    removeAdmin();
  }, [removeUser, removeAdmin]);

  return (
    <AuthContext.Provider value={{ user, admin, loginClient, signupClient, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
