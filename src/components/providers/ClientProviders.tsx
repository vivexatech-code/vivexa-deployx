'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { RouterProvider } from '@/context/RouterContext';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RouterProvider>
        {children}
      </RouterProvider>
    </AuthProvider>
  );
}
