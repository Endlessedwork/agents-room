'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Select a room
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Choose a room from the sidebar, or create your first room to get
          started.
        </p>
        <Link href="/rooms/new" className={cn(buttonVariants(), 'mt-6 inline-flex')}>
          Create your first room
        </Link>
      </div>
    </div>
  );
}
