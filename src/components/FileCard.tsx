import React from 'react';
import { Download, ExternalLink, File, FileText, Folder, ImageIcon, Trash2, Video } from 'lucide-react';
import { cn, formatDate, formatBytes } from '@/utils/cn';

export type DriveExplorerItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string | null;
  modifiedTime: string | null;
  isFolder: boolean;
  link: string | null;
};


const getTypeIcon = (item: DriveExplorerItem) => {
  if (item.isFolder) return <Folder size={20} className="text-[#F4B400]" />;
  if (item.mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-[#4DA6FF]" />;
  if (item.mimeType.startsWith('video/')) return <Video size={20} className="text-[#8B5CF6]" />;
  if (item.mimeType.includes('pdf')) return <FileText size={20} className="text-[#FF4D4D]" />;
  return <File size={20} className="text-[#A1A1AA]" />;
};

export const FileCard: React.FC<{
  item: DriveExplorerItem;
  onOpen: (item: DriveExplorerItem) => void;
  onDownload?: (item: DriveExplorerItem) => void;
  onDelete?: (item: DriveExplorerItem) => void;
}> = ({ item, onOpen, onDownload, onDelete }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [previewError, setPreviewError] = React.useState(false);

  const isImage = !item.isFolder && item.mimeType.startsWith('image/');
  const previewUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w1000`;

  const typeLabel = item.isFolder
    ? 'PASTA'
    : item.mimeType.includes('pdf')
      ? 'PDF'
      : item.mimeType.startsWith('image/')
        ? 'IMAGEM'
        : item.mimeType.startsWith('video/')
          ? 'VIDEO'
          : 'ARQUIVO';

  return (
    <div className="relative group">
      <div
        role="button"
        tabIndex={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => onOpen(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen(item);
          }
        }}
        className={cn(
          'interactive-list-clickable text-left p-2.5 h-[128px] rounded-xl border border-border bg-card text-foreground w-full overflow-hidden',
          'hover:border-[#e6e9ef]'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="w-8 h-8 rounded-lg bg-muted/40 border border-border flex items-center justify-center shrink-0">
            {getTypeIcon(item)}
          </div>
          <span className="text-ui-label">
            {typeLabel}
          </span>
        </div>

        <div className="space-y-0.5 min-w-0 mt-1">
          <p className="truncate text-ui-title" title={item.name}>
            {item.name}
          </p>
          <p className="truncate text-ui-meta">
            {item.isFolder ? 'PASTA DO DRIVE' : formatBytes(item.size)}
          </p>
        </div>

        <div className="mt-auto space-y-1.5">
          <p className="text-ui-attr">
            {item.modifiedTime ? formatDate(item.modifiedTime) : '-'}
          </p>

          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-[120ms] flex items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen(item);
              }}
              className="interactive-list-clickable h-6 px-2 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:border-[#d7dee8] text-[9px] font-semibold uppercase tracking-wide inline-flex items-center gap-1"
            >
              <ExternalLink size={10} />
              Abrir
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDownload?.(item);
              }}
              disabled={!onDownload || item.isFolder}
              className="interactive-list-clickable h-6 px-2 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:border-[#d7dee8] disabled:opacity-40 disabled:cursor-not-allowed text-[9px] font-semibold uppercase tracking-wide inline-flex items-center gap-1"
            >
              <Download size={10} />
              Baixar
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete?.(item);
              }}
              className="interactive-list-clickable h-6 w-6 rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
              title="Excluir"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      </div>

      {isImage && isHovered && !previewError && (
        <div className="absolute inset-1 rounded-lg border border-border bg-card/95 backdrop-blur-sm pointer-events-none z-20">
          <div className="h-full w-full p-2 flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Visualização</span>
            <div className="flex-1 rounded-md overflow-hidden border border-border bg-muted/40">
              <img
                src={previewUrl}
                alt={item.name}
                className="h-full w-full object-contain"
                onError={() => setPreviewError(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
