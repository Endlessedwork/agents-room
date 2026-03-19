'use client';

import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useRoomStore, type Room } from '@/stores/roomStore';

interface RoomListItemProps {
  room: Room;
  isActive: boolean;
}

export function RoomListItem({ room, isActive }: RoomListItemProps) {
  const router = useRouter();
  const { setActiveRoom, deleteRoom } = useRoomStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const statusColor =
    room.status === 'running'
      ? 'bg-green-500'
      : room.status === 'paused'
        ? 'bg-yellow-500'
        : 'bg-muted-foreground';

  function handleClick() {
    setActiveRoom(room.id);
    router.push(`/rooms/${room.id}`);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRoom(room.id);
      setDeleteOpen(false);
      router.push('/');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={`group flex items-start gap-2 px-3 py-2 rounded cursor-pointer transition-colors relative ${
          isActive
            ? 'bg-primary/10 border-l-2 border-primary'
            : 'hover:bg-accent border-l-2 border-transparent'
        }`}
        onClick={handleClick}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`}
            />
            <span className="text-sm font-normal truncate">{room.name}</span>
          </div>
          {room.topic && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 pl-4">
              {room.topic}
            </p>
          )}
          {room.lastActivityAt && (
            <p className="text-xs text-muted-foreground pl-4 mt-0.5">
              {formatDistanceToNow(new Date(room.lastActivityAt), {
                addSuffix: true,
              })}
            </p>
          )}
        </div>
        <button
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteOpen(true);
          }}
          aria-label="Delete room"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete room?</DialogTitle>
            <DialogDescription>
              This permanently deletes the room and all its conversation
              history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
