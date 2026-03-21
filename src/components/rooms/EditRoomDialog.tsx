'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditRoomDialogProps {
  roomId: string;
  currentTurnLimit: number;
  currentSpeakerStrategy: 'round-robin' | 'llm-selected';
  currentParallelFirstRound: boolean;
  disabled?: boolean;
  onSaved?: (updated: { turnLimit: number; speakerStrategy: string }) => void;
}

export function EditRoomDialog({
  roomId,
  currentTurnLimit,
  currentSpeakerStrategy,
  currentParallelFirstRound,
  disabled = false,
  onSaved,
}: EditRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [turnLimit, setTurnLimit] = useState(currentTurnLimit);
  const [speakerStrategy, setSpeakerStrategy] = useState<string>(currentSpeakerStrategy);
  const [parallelFirstRound, setParallelFirstRound] = useState(currentParallelFirstRound);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reset to current values when opening
      setTurnLimit(currentTurnLimit);
      setSpeakerStrategy(currentSpeakerStrategy);
      setParallelFirstRound(currentParallelFirstRound);
      setError(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnLimit, speakerStrategy, parallelFirstRound }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOpen(false);
        onSaved?.({ turnLimit: updated.turnLimit, speakerStrategy: updated.speakerStrategy });
      } else if (res.status === 409) {
        setError('Cannot edit while conversation is active. Stop the conversation first.');
      } else {
        setError('Failed to save changes');
      }
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled} />
        }
      >
        Edit
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Room Settings</DialogTitle>
          <DialogDescription>
            Update the turn limit and speaker strategy for this room.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Turn limit */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Turn limit
            </label>
            <div className="flex items-center gap-4">
              <Slider
                value={[turnLimit]}
                onValueChange={(vals) => {
                  const v = Array.isArray(vals) ? vals[0] : vals;
                  setTurnLimit(v as number);
                }}
                min={5}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-sm font-medium tabular-nums w-12 text-right">
                {turnLimit}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum number of agent turns per conversation (5-100)
            </p>
          </div>

          {/* Speaker strategy */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
              Speaker selection
            </label>
            <Select
              value={speakerStrategy}
              onValueChange={(val: string | null) => val && setSpeakerStrategy(val)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round-robin">Round-Robin</SelectItem>
                <SelectItem value="llm-selected">LLM-Selected</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Round-robin cycles through agents in order. LLM-selected uses AI to pick the next speaker.
            </p>
          </div>

          {/* Parallel first round */}
          <div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="edit-parallel-first-round"
                checked={parallelFirstRound}
                onChange={(e) => setParallelFirstRound(e.target.checked)}
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="edit-parallel-first-round" className="text-sm font-medium">
                Parallel first round
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All agents independently form their initial response before seeing each other.
            </p>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" disabled={saving} />}
          >
            Cancel
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
