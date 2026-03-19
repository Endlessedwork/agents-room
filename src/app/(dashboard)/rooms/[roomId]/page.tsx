'use client';

import { useEffect, useState } from 'react';
import { useParams, redirect } from 'next/navigation';
import { useRoomStore } from '@/stores/roomStore';
import { ConversationPanel } from '@/components/rooms/ConversationPanel';

interface RoomAgent {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
}

interface RoomDetail {
  id: string;
  name: string;
  topic: string | null;
  status: 'idle' | 'running' | 'paused';
  roomAgents: RoomAgent[];
}

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { setActiveRoom } = useRoomStore();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    setActiveRoom(roomId);
    fetch(`/api/rooms/${roomId}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setRoom(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });

    return () => {
      // Clear active room when navigating away
    };
  }, [roomId, setActiveRoom]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (notFound || !room) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm font-semibold">Room not found</p>
          <p className="text-xs text-muted-foreground mt-1">
            This room may have been deleted.
          </p>
        </div>
      </div>
    );
  }

  return <ConversationPanel room={room} />;
}
