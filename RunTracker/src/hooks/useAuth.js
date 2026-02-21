// src/hooks/useAuth.js
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange, getPlayer, playerColor } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const p = await getPlayer(firebaseUser.uid);
        setProfile({ ...p, color: playerColor(firebaseUser.uid) });
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
