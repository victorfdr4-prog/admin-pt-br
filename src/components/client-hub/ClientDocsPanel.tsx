import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, ArrowRight, Lock } from 'lucide-react';
import { VARIANTS } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'image' | 'spreadsheet' | 'other';
  size?: string;
  uploadedAt?: string;
  isShared?: boolean;
  onClick?: () => void;
  onDownload?: () => void;
}

interface ClientDocsPanelProps {
  documents: Document[];
  viewAllHref?: string;
  onViewAll?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  className?: string;
}

const FileIcon: React.FC<{ type: string }> = ({ type }) => {
  const config = {
    pdf: { bg: 'bg-red-100', text: 'text-red-700', icon: '📄' },
    doc: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '📝' },
    image: { bg: 'bg-purple-100', text: 'text-purple-700', icon: '🖼️' },
    spreadsheet: { bg: 'bg-green-100', text: 'text-green-700', icon: '📊' },
    other: { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📎' },
  };

  const cfg = config[type as keyof typeof config] || config.other;

  return (
    <div className={cn('flex h-8 w-8 items-center justify-center rounded text-xs font-bold flex-shrink-0', cfg.bg, cfg.text)}>
      {cfg.icon}
    </div>
  );
};

export const ClientDocsPanel: React.FC<ClientDocsPanelProps> = ({
  documents,
  viewAllHref,
  onViewAll,
  isEmpty = false,
  emptyMessage = 'Nenhum documento compartilhado',
  className,
}) => {
  return (
    <motion.div
      variants={VARIANTS.slideInUp}
      initial="hidden"
      animate="visible"
      className={cn('rounded-2xl border border-border bg-white overflow-hidden', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            Documentos
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {documents.length} arquivo{documents.length !== 1 ? 's' : ''}
          </p>
        </div>

        {(viewAllHref || onViewAll) && (
          <motion.button
            type="button"
            onClick={onViewAll}
            whileHover={{ x: 4 }}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline flex-shrink-0"
          >
            Ver todos <ArrowRight size={14} />
          </motion.button>
        )}
      </div>

      {/* Content */}
      {isEmpty || documents.length === 0 ? (
        <div className="flex h-40 items-center justify-center px-6 py-8">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {documents.slice(0, 5).map((doc, index) => (
            <motion.button
              key={doc.id}
              type="button"
              onClick={doc.onClick}
              custom={index}
              variants={{
                hidden: { opacity: 0, x: -10 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { delay: index * 0.05 },
                },
              }}
              initial="hidden"
              animate="visible"
              whileHover={{ x: 2 }}
              className="interactive-list-clickable w-full px-6 py-3 text-left transition-colors hover:bg-border/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileIcon type={doc.type} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                      {doc.isShared && <Lock size={12} className="text-amber-600 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {doc.size && (
                        <span className="text-xs text-muted-foreground">{doc.size}</span>
                      )}
                      {doc.uploadedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(doc.uploadedAt).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    doc.onDownload?.();
                  }}
                  whileHover={{ scale: 1.1 }}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-1"
                >
                  <Download size={14} />
                </motion.button>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Footer if more documents */}
      {documents.length > 5 && (
        <div className="border-t border-border px-6 py-3 text-center">
          <p className="text-xs text-muted-foreground">
            +{documents.length - 5} documento{documents.length - 5 !== 1 ? 's' : ''} não mostrado{documents.length - 5 !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </motion.div>
  );
};
