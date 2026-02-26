'use client';

import { AuthProvider } from '@/components/AuthProvider';
import AppShell from '@/components/AppShell';

export default function Home() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
