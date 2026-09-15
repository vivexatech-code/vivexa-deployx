/**
 * Lightweight Client-Side Router for SPA with Clean Path Matching
 * Supports direct URLs, browser history pushState, popstate, and query parameters.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

interface RouterContextType {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (to: string) => {
    if (to === currentPath) return;
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo(0, 0);
  };

  // Derive simple route parameters (e.g. /dashboard/projects/:id)
  const params: Record<string, string> = {};
  const segments = currentPath.split('/').filter(Boolean);
  if (segments[0] === 'dashboard' && segments[1] === 'projects' && segments[2] && segments[2] !== 'new') {
    params.projectId = segments[2];
  }

  return (
    <RouterContext.Provider value={{ path: currentPath, params, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
