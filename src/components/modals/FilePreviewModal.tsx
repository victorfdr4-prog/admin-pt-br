import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: {
    id: string;
    name: string;
    type: 'pdf' | 'doc' | 'image' | 'spreadsheet' | 'other';
    size?: string;
    uploadedAt?: string;
    url?: string;
  };
  onDownload?: (fileId: string) => Promise<void>;
}

const getFileIcon = (type: string) => {
  const icons: Record<string, string> = {
    pdf: '📄',
    doc: '📝',
    image: '🖼️',
    spreadsheet: '📊',
    other: '📎',
  };
  return icons[type] || '📎';
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onDownload,
}) => {
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (!file) return;
    setIsDownloading(true);
    try {
      await onDownload?.(file.id);
    } catch (error) {
      console.error('Error downloading file:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!file) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl border border-border shadow-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4 sticky top-0 bg-white">
                <h2 className="text-lg font-semibold text-foreground">Visualizar arquivo</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 hover:bg-border rounded-lg transition-colors"
                >
                  <X size={20} className="text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* File info */}
                <div className="mb-6">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{getFileIcon(file.type)}</div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-1">{file.name}</h3>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        {file.size && <span>{file.size}</span>}
                        {file.uploadedAt && (
                          <span>{new Date(file.uploadedAt).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview area */}
                <div className="mb-6 rounded-lg border border-border bg-muted/30 p-8 flex items-center justify-center min-h-[300px]">
                  {file.type === 'image' ? (
                    <img src={file.url} alt={file.name} className="max-w-full max-h-96 rounded-lg" />
                  ) : (
                    <div className="text-center">
                      <FileText size={48} className="text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
                        Visualização de {file.type} não disponível
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Faça o download para visualizar o arquivo completo
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-border/30 transition-colors"
                  >
                    Fechar
                  </button>
                  {file.url && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-border/30 transition-colors"
                    >
                      <ExternalLink size={16} />
                      Abrir em nova aba
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                      isDownloading
                        ? 'bg-primary/50 text-primary-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    )}
                  >
                    <Download size={16} />
                    {isDownloading ? 'Baixando...' : 'Baixar'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
