'use client';

import { useState, useEffect } from 'react';
import { useChatStore, formatTokenCount } from '@/stores/chatStore';
import { formatCost } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EditRoomDialog } from './EditRoomDialog';

interface ChatHeaderProps {
  room: {
    id: string;
    name: string;
    topic: string | null;
    turnLimit: number;
    speakerStrategy: 'round-robin' | 'llm-selected';
    status: 'idle' | 'running' | 'paused';
  };
}

function formatEstimatedCostDisplay(state: {
  dollars: number;
  hasUnknown: boolean;
  hasLocal: boolean;
}): string {
  if (state.hasUnknown) return '\u2014';
  if (state.hasLocal && state.dollars === 0) return 'local';
  return formatCost({ type: 'dollars', value: state.dollars });
}

export function ChatHeader({ room }: ChatHeaderProps) {
  const roomStatus = useChatStore((s) => s.roomStatus);
  const turnProgress = useChatStore((s) => s.turnProgress);
  const setRoomStatus = useChatStore((s) => s.setRoomStatus);
  const tokenTotals = useChatStore((s) => s.tokenTotals);
  const estimatedCostState = useChatStore((s) => s.estimatedCostState);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const summaryLoading = useChatStore((s) => s.summaryLoading);
  const summary = useChatStore((s) => s.summary);

  const [exportOpen, setExportOpen] = useState(false);

  const handleExport = (format: 'md' | 'json') => {
    setExportOpen(false);
    const params = new URLSearchParams({ format });
    if (summary) {
      params.set('summary', summary);
    }
    // Trigger browser download via hidden link
    const url = `/api/rooms/${room.id}/export?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = ''; // Let Content-Disposition set filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (_e: MouseEvent) => {
      setExportOpen(false);
    };
    // Delay to avoid closing immediately on the same click
    const timer = setTimeout(() => {
      document.addEventListener('click', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handler);
    };
  }, [exportOpen]);

  const handleSummarize = async () => {
    const store = useChatStore.getState();
    store.setSummaryLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/summary`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.summary) {
        store.setSummary(data.summary);
      } else {
        store.setSummaryLoading(false);
      }
    } catch {
      store.setSummaryLoading(false);
    }
  };

  const handleStart = () => {
    setRoomStatus('running');
    fetch(`/api/rooms/${room.id}/conversation/start`, { method: 'POST' });
  };

  const handlePause = () => {
    setRoomStatus('paused');
    fetch(`/api/rooms/${room.id}/conversation/pause`, { method: 'POST' });
  };

  const handleStop = () => {
    setRoomStatus('idle');
    fetch(`/api/rooms/${room.id}/conversation/stop`, { method: 'POST' });
  };

  const handleResume = () => {
    setRoomStatus('running');
    fetch(`/api/rooms/${room.id}/conversation/resume`, { method: 'POST' });
  };

  const showTurnProgress = roomStatus !== 'idle' || turnProgress.total > 0;

  return (
    <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
      {/* Left: room info */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-lg">{room.name}</span>
        {roomStatus === 'running' && (
          <Badge variant="default">Running</Badge>
        )}
        {roomStatus === 'paused' && (
          <Badge variant="secondary">Paused</Badge>
        )}
        {roomStatus === 'idle' && (
          <Badge variant="outline">Idle</Badge>
        )}
        {showTurnProgress && (
          <span className="text-sm text-muted-foreground">
            Turn {turnProgress.current} of {turnProgress.total}
          </span>
        )}
        {hasMessages && (
          <span className="text-sm text-muted-foreground">
            Tokens: {formatTokenCount(tokenTotals.input)} in / {formatTokenCount(tokenTotals.output)} out
            {' \u00b7 '}
            {formatEstimatedCostDisplay(estimatedCostState)}
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        <EditRoomDialog
          roomId={room.id}
          currentTurnLimit={room.turnLimit}
          currentSpeakerStrategy={room.speakerStrategy}
          disabled={roomStatus === 'running' || roomStatus === 'paused'}
          onSaved={() => window.location.reload()}
        />
        {hasMessages && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSummarize}
            disabled={summaryLoading}
          >
            {summaryLoading ? 'Generating...' : 'Summarize'}
          </Button>
        )}
        {hasMessages && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(!exportOpen)}
            >
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-md z-20 min-w-[140px]">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => handleExport('md')}
                >
                  Markdown (.md)
                </button>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-t"
                  onClick={() => handleExport('json')}
                >
                  JSON (.json)
                </button>
              </div>
            )}
          </div>
        )}
        {roomStatus === 'idle' && (
          <Button variant="default" size="sm" onClick={handleStart}>
            Start
          </Button>
        )}
        {roomStatus === 'running' && (
          <>
            <Button variant="secondary" size="sm" onClick={handlePause}>
              Pause
            </Button>
            <Button variant="outline" size="sm" onClick={handleStop}>
              Stop
            </Button>
          </>
        )}
        {roomStatus === 'paused' && (
          <>
            <Button variant="default" size="sm" onClick={handleResume}>
              Resume
            </Button>
            <Button variant="outline" size="sm" onClick={handleStop}>
              Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
