import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, PRIMARY_ADMIN_EMAIL } from '../firebase';

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);

      if (!currentUser || !currentUser.emailVerified) {
        setIsAdmin(false);
        setAuthReady(true);
        return;
      }

      if (currentUser.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(adminSnap.exists());
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      setAuthError(message);
    }
  }, []);

  const signOutAdmin = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        authError,
        signInWithGoogle,
        signOutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
