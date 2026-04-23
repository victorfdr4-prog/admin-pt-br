import React, { Suspense, lazy, useState } from 'react';
import { Loader2 } from 'lucide-react';
import SidebarExplorer from '@/components/SidebarExplorer';
import BotaoAuditoriaDrive from '@/components/BotaoAuditoriaDrive';
import { toast } from 'sonner';

const DriveExplorer = lazy(() => import('@/components/DriveExplorer').then((m) => ({ default: m.DriveExplorer })));

export const DrivePage: React.FC = () => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientLabel, setSelectedClientLabel] = useState('');
  const [explorerData, setExplorerData] = useState({ folderName: '', itemCount: 0, link: '' });

  const handleExplorerUpdate = (name: string, count: number, link?: string) => {
    setExplorerData({ folderName: name, itemCount: count, link: link || '' });
  };

  const handleCopyLink = () => {
    if (!explorerData.link) return;
    navigator.clipboard.writeText(explorerData.link);
    toast.success('Link direto copiado!');
  };

  const handleManageAccess = () => {
    if (!explorerData.link) return;
    window.open(explorerData.link, '_blank', 'noopener,noreferrer');
  };

  const handleAuditoriaCompleta = () => {
    toast.success('Sincronizando alterações com o Google Drive...');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
<div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-6 px-4 py-5 md:px-6 md:py-6 xl:px-8">
      <section className="premium-card overflow-hidden">
        <div className="grid min-h-[calc(100vh-220px)] lg:grid-cols-[300px_minmax(0,1fr)]">
          <SidebarExplorer
            onSelectClient={(id, name) => {
              setSelectedClientId(id);
              setSelectedClientLabel(name);
            }}
            selectedClientId={selectedClientId}
            currentFolderName={explorerData.folderName}
            itemCount={explorerData.itemCount}
            currentFolderLink={explorerData.link}
            onCopyLink={handleCopyLink}
            onManageAccess={handleManageAccess}
            onAuditoriaCompleta={handleAuditoriaCompleta}
          />

          <main className="min-w-0 flex-1 space-y-4 p-4">
            <div className="section-panel flex flex-wrap items-start justify-between gap-3 p-3.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Drive</p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                  {selectedClientLabel || 'Selecione um cliente'}
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Pasta de trabalho, arquivos e auditoria do Google Drive no mesmo painel.
                </p>
              </div>

              {selectedClientId ? (
                <BotaoAuditoriaDrive
                  folderIdDoCliente={selectedClientId}
                  onAuditoriaCompleta={handleAuditoriaCompleta}
                />
              ) : (
                <div className="section-panel px-4 py-3 text-sm text-muted-foreground">
                  Selecione um cliente na lateral
                </div>
              )}
            </div>

            {selectedClientId ? (
              <Suspense
                fallback={
                  <div className="section-panel flex h-56 flex-col items-center justify-center gap-3 border-dashed border-border/70 p-5">
                    <Loader2 className="animate-spin text-primary" size={32} />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Carregando drive...
                    </span>
                  </div>
                }
              >
                <DriveExplorer
                  clientId={selectedClientId}
                  clientLabel={selectedClientLabel}
                  onUpdateInfo={handleExplorerUpdate}
                />
              </Suspense>
            ) : (
              <div className="section-panel flex min-h-[280px] flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="max-w-md space-y-2">
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Selecione um cliente</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Escolha um cliente na lateral para abrir o Drive de trabalho. Ex.: Eve Festas, Daniela de Cássia ou Fábio.
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
};

export default DrivePage;
