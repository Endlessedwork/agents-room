'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type AgentPreset } from './AgentPresets';
import { useAgentStore, type Agent } from '@/stores/agentStore';
import { ModelCombobox } from './ModelCombobox';
import type { ProviderStatus } from '@/components/settings/ProviderCard';

const AVATAR_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

const AVATAR_ICONS = [
  { name: 'brain', Icon: Brain },
  { name: 'code', Icon: Code },
  { name: 'book-open', Icon: BookOpen },
  { name: 'flame', Icon: Flame },
  { name: 'sparkles', Icon: Sparkles },
  { name: 'lightbulb', Icon: Lightbulb },
  { name: 'shield', Icon: Shield },
  { name: 'eye', Icon: Eye },
  { name: 'search', Icon: Search },
  { name: 'heart', Icon: Heart },
  { name: 'star', Icon: Star },
  { name: 'zap', Icon: Zap },
];

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
  google: 'gemini-2.0-flash',
  openrouter: 'meta-llama/llama-3.1-8b-instruct:free',
  ollama: 'llama3.2',
};

type Provider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'ollama';

function getStatusConfig(status: ProviderStatus) {
  switch (status) {
    case 'verified':
      return { dotClass: 'bg-green-500', textClass: 'text-green-500', label: 'Connected' };
    case 'failed':
      return { dotClass: 'bg-red-500', textClass: 'text-red-500', label: 'Failed' };
    case 'configured':
      return { dotClass: 'bg-yellow-500', textClass: 'text-yellow-500', label: 'Not tested' };
    case 'unconfigured':
    default:
      return { dotClass: 'bg-muted-foreground', textClass: 'text-muted-foreground', label: 'Not configured' };
  }
}

interface AgentFormProps {
  preset?: AgentPreset | null;
  initialData?: Agent | null;
}

export function AgentForm({ preset, initialData }: AgentFormProps) {
  const router = useRouter();
  const isEditMode = Boolean(initialData?.id);

  const [name, setName] = useState(initialData?.name ?? preset?.name ?? '');
  const [avatarColor, setAvatarColor] = useState(initialData?.avatarColor ?? preset?.avatarColor ?? '#3B82F6');
  const [avatarIcon, setAvatarIcon] = useState(initialData?.avatarIcon ?? preset?.avatarIcon ?? 'brain');
  const [promptRole, setPromptRole] = useState(initialData?.promptRole ?? preset?.promptRole ?? '');
  const [promptPersonality, setPromptPersonality] = useState(initialData?.promptPersonality ?? preset?.promptPersonality ?? '');
  const [promptRules, setPromptRules] = useState(initialData?.promptRules ?? preset?.promptRules ?? '');
  const [promptConstraints, setPromptConstraints] = useState(initialData?.promptConstraints ?? preset?.promptConstraints ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [provider, setProvider] = useState<Provider>(initialData?.provider ?? preset?.provider ?? 'anthropic');
  const [model, setModel] = useState(initialData?.model ?? preset?.model ?? DEFAULT_MODELS['anthropic']);
  const [temperature, setTemperature] = useState(initialData?.temperature ?? preset?.temperature ?? 0.7);
  const [saving, setSaving] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [providerStatuses, setProviderStatuses] = useState<Record<string, ProviderStatus>>({});

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data: Array<{ provider: string; status: ProviderStatus }>) => {
        const map: Record<string, ProviderStatus> = {};
        for (const p of data) {
          map[p.provider] = p.status;
        }
        setProviderStatuses(map);
      })
      .catch(() => {});
  }, []);

  // Update model when provider changes (only if not pre-filled from preset)
  function handleProviderChange(val: string | null) {
    if (!val) return;
    const p = val as Provider;
    setProvider(p);
    setModel(DEFAULT_MODELS[p] ?? '');
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'This field is required.';
    if (!promptRole.trim()) errs.promptRole = 'This field is required.';
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);

    const payload = {
      name: name.trim(),
      avatarColor,
      avatarIcon,
      promptRole: promptRole.trim(),
      promptPersonality: promptPersonality.trim() || null,
      promptRules: promptRules.trim() || null,
      promptConstraints: promptConstraints.trim() || null,
      provider,
      model: model.trim(),
      temperature,
      notes: notes.trim() || null,
      ...(isEditMode ? {} : { presetId: preset?.id ?? null }),
    };

    try {
      if (isEditMode) {
        await useAgentStore.getState().updateAgent(initialData!.id, payload);
      } else {
        const res = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setSaving(false);
          return;
        }
      }
      router.push('/agents');
    } catch {
      setSaving(false);
    }
  }

  async function handleSaveAsPreset() {
    setSavingPreset(true);
    try {
      const presetPayload = {
        name: name.trim(),
        avatarColor,
        avatarIcon,
        promptRole: promptRole.trim(),
        promptPersonality: promptPersonality.trim() || null,
        promptRules: promptRules.trim() || null,
        promptConstraints: promptConstraints.trim() || null,
        provider,
        model: model.trim(),
        temperature,
      };
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presetPayload),
      });
      if (res.ok) {
        router.push('/presets');
      }
    } catch {
      // silently fail
    } finally {
      setSavingPreset(false);
    }
  }

  const selectedIconEntry = AVATAR_ICONS.find((i) => i.name === avatarIcon);
  const SelectedIcon = selectedIconEntry?.Icon ?? Brain;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {isEditMode && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Editing this agent won&apos;t affect rooms already using it.
          </p>
        </div>
      )}
      {/* Name */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="e.g. Devil's Advocate"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name}</p>
        )}
      </div>

      {/* Avatar */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-2 block">
          Avatar
        </label>
        <div className="flex items-center gap-4 mb-3">
          {/* Preview */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            <SelectedIcon size={24} className="text-white" />
          </div>
          <div className="flex-1">
            {/* Color swatches */}
            <div className="flex flex-wrap gap-2 mb-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    avatarColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
            {/* Icon picker */}
            <div className="flex flex-wrap gap-1">
              {AVATAR_ICONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setAvatarIcon(name)}
                  className={`p-1.5 rounded border transition-colors ${
                    avatarIcon === name
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent'
                  }`}
                  aria-label={`Icon ${name}`}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Prompt Role */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Role <span className="text-destructive">*</span>
        </label>
        <Textarea
          value={promptRole}
          onChange={(e) => setPromptRole(e.target.value)}
          rows={3}
          placeholder="e.g. You are a senior software architect with 15 years of experience..."
          className={errors.promptRole ? 'border-destructive' : ''}
        />
        {errors.promptRole && (
          <p className="text-xs text-destructive mt-1">{errors.promptRole}</p>
        )}
      </div>

      {/* Prompt Personality */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Personality traits
        </label>
        <Textarea
          value={promptPersonality}
          onChange={(e) => setPromptPersonality(e.target.value)}
          rows={3}
          placeholder="e.g. Direct, skeptical, challenges assumptions before accepting them..."
        />
      </div>

      {/* Prompt Rules */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Rules
        </label>
        <Textarea
          value={promptRules}
          onChange={(e) => setPromptRules(e.target.value)}
          rows={3}
          placeholder="e.g. Always ask for evidence. Never agree without examining the premise..."
        />
      </div>

      {/* Prompt Constraints */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Constraints
        </label>
        <Textarea
          value={promptConstraints}
          onChange={(e) => setPromptConstraints(e.target.value)}
          rows={2}
          placeholder="e.g. Do not use jargon. Keep responses under 200 words..."
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Notes
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="e.g. Best for challenging group consensus. Strong at finding logical flaws..."
        />
        <p className="text-xs text-muted-foreground mt-1">
          Private notes about this agent's purpose and strengths. Visible in the library.
        </p>
      </div>

      {/* Provider */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Provider
        </label>
        <div className="flex items-center gap-2">
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anthropic">Anthropic — Claude</SelectItem>
              <SelectItem value="openai">OpenAI — GPT</SelectItem>
              <SelectItem value="google">Google — Gemini</SelectItem>
              <SelectItem value="openrouter">OpenRouter</SelectItem>
              <SelectItem value="ollama">Ollama — Local</SelectItem>
            </SelectContent>
          </Select>
          {(() => {
            const currentProviderStatus = providerStatuses[provider] ?? 'unconfigured';
            const statusCfg = getStatusConfig(currentProviderStatus);
            return (
              <>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusCfg.dotClass}`} />
                <span className={`text-xs whitespace-nowrap ${statusCfg.textClass}`}>
                  {statusCfg.label}
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Model
        </label>
        <ModelCombobox
          provider={provider}
          providerConfigured={(providerStatuses[provider] ?? 'unconfigured') !== 'unconfigured'}
          value={model}
          onChange={setModel}
        />
      </div>

      {/* Temperature */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
          Temperature: {temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(Number(e.target.value))}
          className="w-full h-1 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0.0 (precise)</span>
          <span>1.0 (creative)</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Agent'}
        </Button>
        {isEditMode && (
          <Button type="button" variant="outline" onClick={handleSaveAsPreset} disabled={savingPreset}>
            {savingPreset ? 'Saving...' : 'Save as Preset'}
          </Button>
        )}
      </div>
    </form>
  );
}
