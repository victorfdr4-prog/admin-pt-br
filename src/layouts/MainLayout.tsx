import type React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CommandPalette } from '@/components/CommandPalette';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <CommandPalette />
    </>
  );
}

export default MainLayout;
