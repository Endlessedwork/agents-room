'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type ProviderStatus = 'unconfigured' | 'configured' | 'verified' | 'failed';

interface ProviderCardProps {
  provider: string;
  displayName: string;
  status: ProviderStatus;
  hasKey: boolean;
  baseUrl?: string | null;
  onStatusChange?: (status: ProviderStatus) => void;
}

function getStatusConfig(status: ProviderStatus) {
  switch (status) {
    case 'verified':
      return {
        dotClass: 'bg-green-500',
        textClass: 'text-green-500',
        label: 'Connected',
      };
    case 'failed':
      return {
        dotClass: 'bg-red-500',
        textClass: 'text-red-500',
        label: 'Failed',
      };
    case 'configured':
      return {
        dotClass: 'bg-yellow-500',
        textClass: 'text-yellow-500',
        label: 'Not tested',
      };
    case 'unconfigured':
    default:
      return {
        dotClass: 'bg-muted-foreground',
        textClass: 'text-muted-foreground',
        label: 'Not configured',
      };
  }
}

export function ProviderCard({
  provider,
  displayName,
  status: initialStatus,
  hasKey,
  baseUrl: initialBaseUrl,
  onStatusChange,
}: ProviderCardProps) {
  const [status, setStatus] = useState<ProviderStatus>(initialStatus);
  const [apiKey, setApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState(initialBaseUrl ?? '');
  const [testing, setTesting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const statusCfg = getStatusConfig(status);

  async function handleKeyBlur() {
    if (!apiKey.trim()) return;
    await fetch(`/api/providers/${provider}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    });
    setStatus('configured');
    onStatusChange?.('configured');
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      await handleKeyBlur();
    }
  }

  async function handleBaseUrlBlur() {
    if (!customBaseUrl.trim()) return;
    await fetch(`/api/providers/${provider}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: customBaseUrl.trim() }),
    });
  }

  async function handleTest() {
    setTesting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/providers/${provider}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setStatus('verified');
        onStatusChange?.('verified');
      } else {
        setStatus('failed');
        onStatusChange?.('failed');
        setErrorMsg('Connection failed. Check your API key and try again.');
      }
    } catch {
      setStatus('failed');
      onStatusChange?.('failed');
      setErrorMsg('Connection failed. Check your API key and try again.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{displayName}</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${statusCfg.dotClass}`}
            />
            <span className={`text-xs font-semibold ${statusCfg.textClass}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
            API Key
          </label>
          <Input
            type="password"
            placeholder={hasKey ? '••••••••••••••••' : 'Enter API key...'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={handleKeyBlur}
            onKeyDown={handleKeyDown}
          />
        </div>

        {provider === 'ollama' && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Custom host URL
            </label>
            <Input
              type="text"
              placeholder="http://localhost:11434"
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              onBlur={handleBaseUrlBlur}
            />
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleTest}
          disabled={testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 size={14} className="mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            'Test Connection'
          )}
        </Button>

        {errorMsg && (
          <p className="text-xs text-red-500">{errorMsg}</p>
        )}
      </CardContent>
    </Card>
  );
}
