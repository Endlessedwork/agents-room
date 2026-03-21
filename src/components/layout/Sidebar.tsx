'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { KeyRound, Users, Plus, Layers } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/roomStore';
import { RoomListItem } from './RoomListItem';

export function Sidebar() {
  const { rooms, activeRoomId, fetchRooms } = useRoomStore();
  const pathname = usePathname();

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  return (
    <aside className="w-[240px] flex-shrink-0 h-screen flex flex-col bg-card border-r border-border">
      {/* App name */}
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight">Agents Room</h1>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="py-2">
            {rooms.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-semibold text-foreground">
                  No rooms yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first room to start a conversation between agents.
                </p>
              </div>
            ) : (
              rooms.map((room) => (
                <RoomListItem
                  key={room.id}
                  room={room}
                  isActive={activeRoomId === room.id}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border p-3 flex flex-col gap-1">
        <Link href="/agents" className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-accent transition-colors">
          <Users size={16} />
          Agents
        </Link>
        <Link href="/presets" className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-accent transition-colors">
          <Layers size={16} />
          Presets
        </Link>
        <Link href="/providers" className="flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-accent transition-colors">
          <KeyRound size={16} />
          Providers
        </Link>
        <Link href="/rooms/new" className={cn(buttonVariants({ size: 'sm' }), 'mt-2 w-full justify-center')}>
          <Plus size={16} className="mr-1" />
          New Room
        </Link>
      </div>
    </aside>
  );
}
