import { create } from 'zustand';
import { nanoid } from 'nanoid';

export function formatTokenCount(n: number): string {
  if (n === 0) return '0';
  if (n < 1000) return String(n);
  return `${Math.round(n / 100) / 10}k`;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agentId: string | null;
  agentName: string | null;
  avatarColor: string | null;
  avatarIcon: string | null;
  promptRole: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  createdAt: string; // ISO string
}

export interface StreamingState {
  agentId: string;
  agentName: string;
  avatarColor: string;
  avatarIcon: string;
  promptRole: string;
  model: string;
  text: string;
}

interface ChatStore {
  messages: ChatMessage[];
  messageIds: Set<string>;
  streaming: StreamingState | null;
  roomStatus: 'idle' | 'running' | 'paused';
  turnProgress: { current: number; total: number };
  tokenTotals: { input: number; output: number };
  summary: string | null;
  summaryLoading: boolean;

  // Actions
  loadHistory: (roomId: string) => Promise<void>;
  startTurn: (data: {
    agentId: string;
    agentName: string;
    avatarColor: string;
    avatarIcon: string;
    promptRole: string;
    model: string;
    turnNumber: number;
    totalTurns: number;
  }) => void;
  appendToken: (agentId: string, text: string) => void;
  completeTurn: (data: {
    agentId: string;
    messageId: string;
    inputTokens: number | null;
    outputTokens: number | null;
  }) => void;
  cancelTurn: () => void;
  addSystemMessage: (content: string) => void;
  addUserMessage: (msg: { id: string; content: string; createdAt: string }) => void;
  setRoomStatus: (status: 'idle' | 'running' | 'paused') => void;
  updateTokenTotals: (inputTokens: number, outputTokens: number) => void;
  setSummary: (text: string) => void;
  clearSummary: () => void;
  setSummaryLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  messageIds: new Set<string>(),
  streaming: null,
  roomStatus: 'idle',
  turnProgress: { current: 0, total: 0 },
  tokenTotals: { input: 0, output: 0 },
  summary: null,
  summaryLoading: false,

  loadHistory: async (roomId: string) => {
    const res = await fetch(`/api/rooms/${roomId}/messages`);
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: ChatMessage[] = (data as any[]).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      agentId: m.roomAgentId,
      agentName: m.roomAgent?.name ?? null,
      avatarColor: m.roomAgent?.avatarColor ?? null,
      avatarIcon: m.roomAgent?.avatarIcon ?? null,
      promptRole: m.roomAgent?.promptRole ?? null,
      model: m.model,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      createdAt: typeof m.createdAt === 'string' ? m.createdAt : new Date(m.createdAt).toISOString(),
    }));
    const ids = new Set(mapped.map((m) => m.id));
    const tokenTotals = mapped.reduce(
      (acc, m) => ({
        input: acc.input + (m.inputTokens ?? 0),
        output: acc.output + (m.outputTokens ?? 0),
      }),
      { input: 0, output: 0 },
    );
    set({ messages: mapped, messageIds: ids, tokenTotals });
  },

  startTurn: (data) => {
    set({
      streaming: {
        agentId: data.agentId,
        agentName: data.agentName,
        avatarColor: data.avatarColor,
        avatarIcon: data.avatarIcon,
        promptRole: data.promptRole,
        model: data.model,
        text: '',
      },
      turnProgress: { current: data.turnNumber, total: data.totalTurns },
    });
  },

  appendToken: (agentId, text) => {
    set((state) => {
      if (!state.streaming || state.streaming.agentId !== agentId) return state;
      return {
        streaming: { ...state.streaming, text: state.streaming.text + text },
      };
    });
  },

  completeTurn: (data) => {
    const state = get();
    if (!state.streaming) return;
    // Deduplication: skip if already in messageIds
    if (state.messageIds.has(data.messageId)) {
      set({ streaming: null });
      return;
    }
    const completed: ChatMessage = {
      id: data.messageId,
      role: 'agent',
      content: state.streaming.text,
      agentId: state.streaming.agentId,
      agentName: state.streaming.agentName,
      avatarColor: state.streaming.avatarColor,
      avatarIcon: state.streaming.avatarIcon,
      promptRole: state.streaming.promptRole,
      model: state.streaming.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      createdAt: new Date().toISOString(),
    };
    const newIds = new Set(state.messageIds);
    newIds.add(data.messageId);
    set({
      messages: [...state.messages, completed],
      messageIds: newIds,
      streaming: null,
    });
  },

  cancelTurn: () => {
    set({ streaming: null });
  },

  addSystemMessage: (content) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: nanoid(),
          role: 'system',
          content,
          agentId: null,
          agentName: null,
          avatarColor: null,
          avatarIcon: null,
          promptRole: null,
          model: null,
          inputTokens: null,
          outputTokens: null,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  },

  addUserMessage: (msg) => {
    const state = get();
    if (state.messageIds.has(msg.id)) return;
    const newIds = new Set(state.messageIds);
    newIds.add(msg.id);
    set({
      messages: [
        ...state.messages,
        {
          id: msg.id,
          role: 'user',
          content: msg.content,
          agentId: null,
          agentName: null,
          avatarColor: null,
          avatarIcon: null,
          promptRole: null,
          model: null,
          inputTokens: null,
          outputTokens: null,
          createdAt: msg.createdAt,
        },
      ],
      messageIds: newIds,
    });
  },

  setRoomStatus: (status) => {
    set({ roomStatus: status, ...(status === 'idle' ? { streaming: null } : {}) });
  },

  updateTokenTotals: (inputTokens, outputTokens) => {
    set((state) => ({
      tokenTotals: {
        input: state.tokenTotals.input + inputTokens,
        output: state.tokenTotals.output + outputTokens,
      },
    }));
  },

  setSummary: (text) => set({ summary: text, summaryLoading: false }),

  clearSummary: () => set({ summary: null }),

  setSummaryLoading: (loading) => set({ summaryLoading: loading }),

  reset: () => {
    set({
      messages: [],
      messageIds: new Set<string>(),
      streaming: null,
      roomStatus: 'idle',
      turnProgress: { current: 0, total: 0 },
      tokenTotals: { input: 0, output: 0 },
      summary: null,
      summaryLoading: false,
    });
  },
}));
