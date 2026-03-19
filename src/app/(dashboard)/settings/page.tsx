'use client';

import { useEffect, useState } from 'react';
import { ProviderCard, type ProviderStatus } from '@/components/settings/ProviderCard';

interface ProviderData {
  provider: string;
  status: ProviderStatus;
  apiKey: boolean;
  baseUrl: string | null;
  lastTestedAt: string | null;
}

const PROVIDER_DISPLAY: Record<string, string> = {
  anthropic: 'Anthropic — Claude',
  openai: 'OpenAI — GPT',
  google: 'Google — Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama — Local',
};

const PROVIDER_ORDER = ['anthropic', 'openai', 'google', 'openrouter', 'ollama'];

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((data) => {
        setProviders(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleStatusChange(provider: string, status: ProviderStatus) {
    setProviders((prev) =>
      prev.map((p) => (p.provider === provider ? { ...p, status } : p))
    );
  }

  const sorted = PROVIDER_ORDER.map((key) =>
    providers.find((p) => p.provider === key)
  ).filter(Boolean) as ProviderData[];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">Settings</h1>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading providers...</p>
      ) : (
        <div className="flex flex-col gap-8 max-w-xl">
          {sorted.map((p) => (
            <ProviderCard
              key={p.provider}
              provider={p.provider}
              displayName={PROVIDER_DISPLAY[p.provider] ?? p.provider}
              status={p.status}
              hasKey={p.apiKey}
              baseUrl={p.baseUrl}
              onStatusChange={(s) => handleStatusChange(p.provider, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
