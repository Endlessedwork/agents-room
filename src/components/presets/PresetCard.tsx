'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Brain, Code, BookOpen, Flame, Sparkles, Lightbulb,
  Shield, Eye, Search, Heart, Star, Zap
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePresetStore, type Preset } from '@/stores/presetStore';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  brain: Brain,
  code: Code,
  'book-open': BookOpen,
  flame: Flame,
  sparkles: Sparkles,
  lightbulb: Lightbulb,
  shield: Shield,
  eye: Eye,
  search: Search,
  heart: Heart,
  star: Star,
  zap: Zap,
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
};

interface PresetCardProps {
  preset: Preset;
  onDelete?: (id: string) => void;
}

export function PresetCard({ preset, onDelete }: PresetCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const Icon = ICON_MAP[preset.avatarIcon] ?? Brain;

  async function handleDelete() {
    setDeleting(true);
    try {
      await usePresetStore.getState().deletePreset(preset.id);
      onDelete?.(preset.id);
      setDeleteOpen(false);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: preset.avatarColor }}
            >
              <Icon size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold truncate">{preset.name}</h3>
                {preset.isSystem && (
                  <Badge variant="secondary" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              {preset.promptRole && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {preset.promptRole}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {PROVIDER_LABELS[preset.provider] ?? preset.provider}
                </Badge>
                <span className="text-xs text-muted-foreground">{preset.model}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  T: {preset.temperature.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
          {!preset.isSystem && (
            <div className="flex gap-2 mt-3 justify-end">
              <Link
                href={`/presets/${preset.id}/edit`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Edit
              </Link>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete preset?</DialogTitle>
            <DialogDescription>
              This will permanently delete {preset.name} from your presets.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
