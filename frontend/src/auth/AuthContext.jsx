import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, getCurrentUser } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // ověření tokenu po načtení aplikace
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        console.log('No token in AuthContext, skipping verify');
        setIsLoading(false);
        return;
      }
    
      try {
        console.log('Verifying token', token);
        const currentUser = await getCurrentUser(token);
        console.log('Current user is', currentUser);
        setUser(currentUser);
      } catch (error) {
        console.error('Auth verify failed:', error.message);
        setToken(null);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    }
    

    verifyToken();
  }, [token]);

  async function login(email, password) {
    const { token: newToken, user: userData } = await loginUser(email, password);

    setToken(newToken);
    localStorage.setItem('token', newToken);
    setUser(userData);
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  }

  const value = {
    user,
    token,
    login,          
    logout,         
    isLoading,      
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}