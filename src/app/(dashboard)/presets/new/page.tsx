import { PresetForm } from '@/components/presets/PresetForm';

export default function PresetsNewPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold mb-8">Create Preset</h1>
      <PresetForm />
    </div>
  );
}
