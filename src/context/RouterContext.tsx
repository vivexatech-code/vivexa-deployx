'use client';

import React, { createContext, useContext, Suspense } from 'react';
import { usePathname, useRouter as useNextRouter } from 'next/navigation';

interface RouterContextType {
  path: string;
  params: Record<string, string>;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

function RouterInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const nextRouter = useNextRouter();

  const navigate = (to: string) => {
    nextRouter.push(to);
  };

  const params: Record<string, string> = {};
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'dashboard' && segments[1] === 'projects' && segments[2] && segments[2] !== 'new') {
    params.projectId = segments[2];
  }

  return (
    <RouterContext.Provider value={{ path: pathname, params, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <RouterInner>{children}</RouterInner>
    </Suspense>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
};
