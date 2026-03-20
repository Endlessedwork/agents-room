'use client';

import { useChatStore, formatTokenCount } from '@/stores/chatStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ChatHeaderProps {
  room: {
    id: string;
    name: string;
    topic: string | null;
    turnLimit: number;
  };
}

export function ChatHeader({ room }: ChatHeaderProps) {
  const roomStatus = useChatStore((s) => s.roomStatus);
  const turnProgress = useChatStore((s) => s.turnProgress);
  const setRoomStatus = useChatStore((s) => s.setRoomStatus);
  const tokenTotals = useChatStore((s) => s.tokenTotals);
  const hasMessages = useChatStore((s) => s.messages.length > 0);
  const summaryLoading = useChatStore((s) => s.summaryLoading);

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
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
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
