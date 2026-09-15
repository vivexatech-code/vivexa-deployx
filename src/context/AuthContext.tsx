/**
 * Authentication Context
 * Manages reactive Firebase auth state, user profile synchronization, and admin authorization.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { authService } from '../services/auth.service';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (auth.currentUser) {
      try {
        const p = await authService.syncUserProfile(auth.currentUser);
        setProfile(p);
      } catch (err) {
        console.warn('Failed to refresh profile:', err);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const p = await authService.syncUserProfile(currentUser);
          setProfile(p);
        } catch (err) {
          console.error('Auth synchronization error:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const p = await authService.signInWithGoogle();
    setProfile(p);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const p = await authService.signInWithEmail(email, pass);
    setProfile(p);
  };

  const signUpWithEmail = async (name: string, email: string, pass: string) => {
    const p = await authService.signUpWithEmail(name, email, pass);
    setProfile(p);
  };

  const signOut = async () => {
    await authService.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = Boolean(
    profile?.role === 'admin' ||
    user?.email?.toLowerCase() === 'vivexatech@gmail.com'
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
