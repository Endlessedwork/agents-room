'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePresetStore } from '@/stores/presetStore';
import { PresetCard } from '@/components/presets/PresetCard';

export default function PresetsPage() {
  const { presets, fetchPresets } = usePresetStore();
  const [localPresets, setLocalPresets] = useState(presets);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  useEffect(() => {
    setLocalPresets(presets);
  }, [presets]);

  function handleDelete(id: string) {
    setLocalPresets((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold">Presets</h1>
        <Link href="/presets/new" className={cn(buttonVariants())}>
          Create Preset
        </Link>
      </div>

      {localPresets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm font-semibold">No presets yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a preset to reuse agent configurations as templates.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {localPresets.map((preset) => (
            <PresetCard key={preset.id} preset={preset} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
