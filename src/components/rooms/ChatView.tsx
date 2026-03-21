'use client';

import { useEffect } from 'react';
import { useRoomStream } from '@/hooks/useRoomStream';
import { useChatStore } from '@/stores/chatStore';
import { ChatHeader } from './ChatHeader';
import { MessageFeed } from './MessageFeed';
import { MessageInput } from './MessageInput';

interface RoomAgent {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
  promptRole: string;
  model: string;
}

interface ChatViewProps {
  room: {
    id: string;
    name: string;
    topic: string | null;
    status: 'idle' | 'running' | 'paused';
    turnLimit: number;
    speakerStrategy: 'round-robin' | 'llm-selected';
    parallelFirstRound?: boolean;
    roomAgents: RoomAgent[];
  };
}

export function ChatView({ room }: ChatViewProps) {
  useRoomStream(room.id);

  useEffect(() => {
    const store = useChatStore.getState();
    store.reset();
    store.setRoomStatus(room.status);
    store.loadHistory(room.id);
  }, [room.id, room.status]);

  return (
    <div className="flex flex-col h-full">
      <ChatHeader room={room} />
      <MessageFeed />
      <MessageInput roomId={room.id} />
    </div>
  );
}
