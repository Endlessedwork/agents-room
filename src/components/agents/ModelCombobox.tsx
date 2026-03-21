'use client';

import { useState, useEffect } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ModelInfo {
  id: string;
  contextLength?: number;
  capabilities?: string[];
}

interface ModelComboboxProps {
  provider: string;
  providerConfigured: boolean;
  value: string;
  onChange: (model: string) => void;
}

export function ModelCombobox({ provider, providerConfigured, value, onChange }: ModelComboboxProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!providerConfigured) {
      setModels([]);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/providers/${provider}/models`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(true);
          return;
        }
        const sorted: ModelInfo[] = (data.models ?? []).sort((a: ModelInfo, b: ModelInfo) =>
          a.id.localeCompare(b.id),
        );
        setModels(sorted);
        if (sorted.length > 0 && !value) {
          onChange(sorted[0].id);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [provider, providerConfigured]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: not configured or fetch failed
  if (!providerConfigured || error) {
    return (
      <div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. claude-sonnet-4-20250514"
        />
        {error && (
          <p className="text-xs text-amber-600 mt-1">
            Could not fetch models — enter model ID manually.
          </p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 size={14} className="animate-spin" />
        Loading models...
      </div>
    );
  }

  return (
    <Combobox.Root
      value={value}
      onValueChange={(val) => {
        if (typeof val === 'string') onChange(val);
        else if (val && typeof val === 'object' && 'id' in val) onChange((val as ModelInfo).id);
      }}
      items={models}
      itemToStringLabel={(m) => (m as unknown as ModelInfo).id}
      itemToStringValue={(m) => (m as unknown as ModelInfo).id}
      filter={(item, query) =>
        (item as unknown as ModelInfo).id.toLowerCase().includes(query.toLowerCase())
      }
    >
      <Combobox.InputGroup className="relative w-full">
        <Combobox.Input
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          placeholder="Search models..."
        />
        <Combobox.Trigger className="absolute inset-y-0 right-2 flex items-center text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup className="z-50 max-h-60 overflow-auto rounded-lg border border-border bg-popover shadow-md">
            <Combobox.List className="p-1">
              {(item: unknown) => {
                const m = item as ModelInfo;
                return (
                  <Combobox.Item
                    key={m.id}
                    value={m.id}
                    className="flex items-center cursor-default select-none rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <span>{m.id}</span>
                    {m.capabilities?.map((cap) => (
                      <span key={cap} className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {cap}
                      </span>
                    ))}
                  </Combobox.Item>
                );
              }}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
