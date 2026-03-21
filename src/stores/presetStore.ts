import { create } from 'zustand';

export interface Preset {
  id: string;
  name: string;
  avatarColor: string;
  avatarIcon: string;
  promptRole: string;
  promptPersonality: string | null;
  promptRules: string | null;
  promptConstraints: string | null;
  provider: 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';
  model: string;
  temperature: number;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type CreatePresetBody = Omit<Preset, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>;

interface PresetStore {
  presets: Preset[];
  loading: boolean;
  fetchPresets: () => Promise<void>;
  createPreset: (data: CreatePresetBody) => Promise<Preset>;
  updatePreset: (id: string, data: Partial<CreatePresetBody>) => Promise<Preset>;
  deletePreset: (id: string) => Promise<void>;
}

export const usePresetStore = create<PresetStore>((set) => ({
  presets: [],
  loading: false,
  fetchPresets: async () => {
    set({ loading: true });
    const res = await fetch('/api/presets');
    const presets = await res.json();
    set({ presets, loading: false });
  },
  createPreset: async (data) => {
    const res = await fetch('/api/presets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create preset');
    const preset = await res.json();
    set((s) => ({ presets: [...s.presets, preset] }));
    return preset;
  },
  updatePreset: async (id, data) => {
    const res = await fetch(`/api/presets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update preset');
    const updated = await res.json();
    set((s) => ({ presets: s.presets.map((p) => (p.id === id ? updated : p)) }));
    return updated;
  },
  deletePreset: async (id) => {
    const res = await fetch(`/api/presets/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete preset');
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) }));
  },
}));
