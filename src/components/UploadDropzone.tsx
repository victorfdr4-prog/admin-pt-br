import React from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ptBR } from '@/lib/ptBR';

type UploadContext = {
  network?: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'other';
  format?: 'feed' | 'story' | 'reel' | 'video' | 'carrossel' | 'other';
};

const RECOMMENDED_SIZES: Record<string, string> = {
  'instagram:feed': '1080x1080px',
  'instagram:story': '1080x1920px',
  'instagram:reel': '1080x1920px',
  'facebook:feed': '1200x630px',
  'linkedin:feed': '1200x627px',
  'tiktok:video': '1080x1920px',
  'youtube:video': '1280x720px',
};

export const UploadDropzone: React.FC<{
  onFiles: (files: File[]) => Promise<void> | void;
  disabled?: boolean;
  context?: UploadContext;
}> = ({ onFiles, disabled, context }) => {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const recommendationKey = `${context?.network || 'other'}:${context?.format || 'other'}`;
  const recommendation = RECOMMENDED_SIZES[recommendationKey];

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;
    const files = Array.from(fileList);
    if (!files.length) return;
    void onFiles(files);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={cn(
        'h-28 rounded-xl border border-dashed p-4 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer',
        dragging
          ? 'border-primary bg-white'
          : 'border-border bg-muted/20 hover:border-primary/55 hover:bg-primary/[0.04]',
        disabled && 'opacity-60 pointer-events-none'
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center text-primary">
        <UploadCloud size={16} />
      </div>
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{ptBR.upload.title}</p>
        <p className="text-[11px] text-muted-foreground">{ptBR.upload.subtitle}</p>
        {recommendation && (
          <p className="text-[11px] text-primary/90">
            {ptBR.upload.contextPrefix}: {recommendation}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          inputRef.current?.click();
        }}
        className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-[10px] font-semibold uppercase tracking-wide hover:bg-muted transition-colors"
      >
        {ptBR.upload.button}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
};
