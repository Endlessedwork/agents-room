import { create } from 'zustand';

export interface Room {
  id: string;
  name: string;
  topic: string | null;
  status: 'idle' | 'running' | 'paused';
  lastActivityAt: Date | null;
  createdAt: Date;
  agentCount?: number;
}

interface RoomStore {
  rooms: Room[];
  activeRoomId: string | null;
  loading: boolean;
  fetchRooms: () => Promise<void>;
  setActiveRoom: (id: string | null) => void;
  createRoom: (name: string, topic?: string) => Promise<Room>;
  deleteRoom: (id: string) => Promise<void>;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  rooms: [],
  activeRoomId: null,
  loading: false,
  fetchRooms: async () => {
    set({ loading: true });
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    set({ rooms, loading: false });
  },
  setActiveRoom: (id) => set({ activeRoomId: id }),
  createRoom: async (name, topic) => {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, topic }),
    });
    const room = await res.json();
    await get().fetchRooms();
    return room;
  },
  deleteRoom: async (id) => {
    await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== id),
      activeRoomId: s.activeRoomId === id ? null : s.activeRoomId,
    }));
  },
}));
