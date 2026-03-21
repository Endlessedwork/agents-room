import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { presets } from '@/db/schema';
import { PresetForm } from '@/components/presets/PresetForm';
import type { Preset } from '@/stores/presetStore';

interface PresetEditPageProps {
  params: Promise<{ presetId: string }>;
}

export default async function PresetEditPage({ params }: PresetEditPageProps) {
  const { presetId } = await params;

  const [preset] = await db.select().from(presets).where(eq(presets.id, presetId));

  if (!preset || preset.isSystem) {
    redirect('/presets');
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">Edit Preset</h1>
      <PresetForm initialData={preset as unknown as Preset} />
    </div>
  );
}
