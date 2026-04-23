import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderPlus,
  Grid3X3,
  LayoutList,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  Rocket,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Breadcrumb, type BreadcrumbItem } from '@/components/Breadcrumb';
import { FileCard, type DriveExplorerItem } from '@/components/FileCard';
import { UploadDropzone } from '@/components/UploadDropzone';
import { DriveService } from '@/services';
import { cn, formatDate, formatBytes } from '@/utils/cn';
import { toast } from 'sonner';
const reportSystemError = (payload: unknown) => {
  console.error('DriveExplorer diagnostic', payload);
};

const getDriveErrorMessage = (error: unknown, fallback: string) => {
  const message = String((error as { message?: unknown })?.message || '');

  if (message.includes('NOT_AUTHENTICATED') || message.includes('HTTP_401')) {
    return 'Sessão expirada ou inválida. Faça login novamente para acessar o Drive.';
  }

  if (message.includes('HTTP_403')) {
    return 'Seu usuário não tem permissão para acessar este cliente no Drive.';
  }

  return message || fallback;
};

const getTypeLabel = (item: DriveExplorerItem) => {
  if (item.isFolder) return 'PASTA';
  if (item.mimeType.includes('pdf')) return 'PDF';
  if (item.mimeType.startsWith('image/')) return 'IMAGEM';
  if (item.mimeType.startsWith('video/')) return 'VIDEO';
  return 'ARQUIVO';
};

// 🔥 Dicionário de Roteamento Inteligente
const DIRETORIOS_INTELIGENTES: Record<string, string> = {
  pdf: '04_CONTRATOS',
  doc: '04_CONTRATOS',
  docx: '04_CONTRATOS',
  xls: '04_CONTRATOS',
  xlsx: '04_CONTRATOS',
  ppt: '04_CONTRATOS',
  pptx: '04_CONTRATOS',
  ai: '01_LOGO',
  eps: '01_LOGO',
  svg: '01_LOGO',
  cdr: '01_LOGO',
  jpg: '02_FOTOS',
  jpeg: '02_FOTOS',
  png: '02_FOTOS',
  webp: '02_FOTOS',
  raw: '02_FOTOS',
  heic: '02_FOTOS',
  mp4: '05_ANUNCIOS',
  mov: '05_ANUNCIOS',
  avi: '05_ANUNCIOS',
  mkv: '05_ANUNCIOS',
  mp3: '06_AUDIO',
  wav: '06_AUDIO',
  psd: '03_EDITAVEIS',
  fig: '03_EDITAVEIS',
  xd: '03_EDITAVEIS',
};

export const DriveExplorer: React.FC<{
  clientId: string;
  clientLabel?: string;
  onUpdateInfo?: (folderName: string, itemCount: number, currentFolderLink?: string) => void;
}> = ({ clientId, clientLabel, onUpdateInfo }) => {
  const [currentFolderId, setCurrentFolderId] = React.useState('');
  const [rootFolderId, setRootFolderId] = React.useState('');
  const [files, setFiles] = React.useState<DriveExplorerItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'name' | 'date'>('date');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([]);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [creatingFolder, setCreatingFolder] = React.useState(false);
  const [showCreateFolderInput, setShowCreateFolderInput] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [isMobile, setIsMobile] = React.useState(false);
  const [lightboxFileId, setLightboxFileId] = React.useState<string | null>(null);
  const [lightboxSourceIndex, setLightboxSourceIndex] = React.useState(0);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const fetchFolder = React.useCallback(
    async (options?: { folderId?: string; breadcrumbOverride?: BreadcrumbItem[]; preserveBreadcrumb?: boolean }) => {
      if (!clientId) return;
      setLoading(true);
      try {
        const data = await DriveService.list({
          clientId,
          folderId: options?.folderId,
          sort: sortBy,
          order: sortOrder,
        });

        const rootLabel = String(clientLabel || data.clientName || 'Cliente').toUpperCase();
        const defaultBreadcrumb = [{ id: data.rootFolderId, label: rootLabel }];

        setRootFolderId(data.rootFolderId);
        setCurrentFolderId(data.currentFolderId);
        setFiles(data.items || []);

        if (onUpdateInfo) {
          const folderName = options?.breadcrumbOverride?.[options.breadcrumbOverride.length - 1]?.label || rootLabel;
          // Tentar encontrar o link da pasta atual na lista de itens ou usar o root
          const currentItem = files.find(f => f.id === data.currentFolderId);
          onUpdateInfo(folderName, data.items?.length || 0, data.currentFolderLink);
        }

        if (options?.breadcrumbOverride) {
          setBreadcrumbs(options.breadcrumbOverride);
        } else if (!options?.preserveBreadcrumb) {
          setBreadcrumbs(defaultBreadcrumb);
        } else {
          setBreadcrumbs((prev) => (prev.length ? prev : defaultBreadcrumb));
        }
      } catch (error: any) {
        toast.error(getDriveErrorMessage(error, 'Falha ao carregar arquivos do Drive.'));
        setFiles([]);
      } finally {
        setLoading(false);
      }
    },
    [clientId, clientLabel, sortBy, sortOrder]
  );

  React.useEffect(() => {
    if (!clientId) {
      setCurrentFolderId('');
      setRootFolderId('');
      setFiles([]);
      setBreadcrumbs([]);
      return;
    }
    void fetchFolder();
  }, [clientId, fetchFolder]);

  React.useEffect(() => {
    if (!clientId || !currentFolderId) return;
    void fetchFolder({
      folderId: currentFolderId,
      breadcrumbOverride: breadcrumbs,
      preserveBreadcrumb: true,
    });
  }, [sortBy, sortOrder]);

  const handleOpenItem = async (item: DriveExplorerItem) => {
    if (item.isFolder) {
      const nextBreadcrumb = [...breadcrumbs, { id: item.id, label: item.name.toUpperCase() }];
      await fetchFolder({
        folderId: item.id,
        breadcrumbOverride: nextBreadcrumb,
        preserveBreadcrumb: true,
      });
      return;
    }

    if (item.mimeType.startsWith('image/')) {
      setLightboxFileId(item.id);
      setLightboxSourceIndex(0);
      return;
    }

    if (item.link) {
      window.open(item.link, '_blank', 'noopener,noreferrer');
      return;
    }

    toast.error('Arquivo sem link de visualização.');
  };

  const handleDownloadItem = (item: DriveExplorerItem) => {
    if (item.isFolder) {
      toast.info('Pastas não possuem download direto.');
      return;
    }
    if (item.link) {
      window.open(item.link, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.error('Arquivo sem link de download.');
  };

  const handleDeleteItem = async (item: DriveExplorerItem) => {
    if (!clientId) return;
    
    const confirmDelete = window.confirm(`Deseja realmente mover "${item.name}" para a lixeira?`);
    if (!confirmDelete) return;

    try {
      setLoading(true);
      await DriveService.delete({
        clientId,
        fileId: item.id
      });
      toast.success('Item movido para a lixeira.');
      await fetchFolder({
        folderId: currentFolderId,
        breadcrumbOverride: breadcrumbs,
        preserveBreadcrumb: true,
      });
    } catch (error: any) {
      reportSystemError({
        source: 'drive',
        message: 'Erro ao excluir item do Drive.',
        details: {
          clientId,
          fileId: item.id,
          error: error.message
        }
      });
      toast.error(getDriveErrorMessage(error, 'Erro ao excluir. Verifique o diagnóstico.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBreadcrumbNavigate = async (item: BreadcrumbItem, index: number) => {
    const nextBreadcrumb = breadcrumbs.slice(0, index + 1);
    await fetchFolder({
      folderId: item.id,
      breadcrumbOverride: nextBreadcrumb,
      preserveBreadcrumb: true,
    });
  };

  const handleUpload = async (items: File[]) => {
    if (!clientId || !currentFolderId) {
      toast.error('Selecione um cliente e uma pasta válida para enviar.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      
      const totalFiles = items.length;
      let filesCompleted = 0;

      for (const file of items) {
        let targetId = currentFolderId;

        // Se estivermos na raiz, aplicar roteamento inteligente
        if (currentFolderId === rootFolderId) {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const targetFolderName = DIRETORIOS_INTELIGENTES[ext];
          
          if (targetFolderName) {
            // Procurar se a pasta já existe
            const targetFolder = files.find(f => f.isFolder && f.name.toUpperCase().includes(targetFolderName));
            if (targetFolder) {
              targetId = targetFolder.id;
            }
          }
        }

        await DriveService.upload({
          clientId,
          folderId: targetId,
          file,
        }, (progress) => {
          const totalProgress = ((filesCompleted / totalFiles) * 100) + (progress / totalFiles);
          setUploadProgress(totalProgress);
        });
        filesCompleted++;
      }
      
      setUploadProgress(100);
      toast.success(`${items.length} arquivo(s) enviado(s).`);
      await fetchFolder({
        folderId: currentFolderId,
        breadcrumbOverride: breadcrumbs,
        preserveBreadcrumb: true,
      });
    } catch (error: any) {
      reportSystemError({
        source: 'drive',
        message: 'Erro ao enviar arquivo para o Drive.',
        details: {
          clientId,
          folderId: currentFolderId,
          files: items.map(f => ({ name: f.name, size: f.size })),
          error: error?.response?.data || error?.message || error
        }
      });
      toast.error(getDriveErrorMessage(error, 'Erro ao enviar arquivo para o Drive.'));
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    const folderName = newFolderName.trim();
    if (!folderName) {
      toast.error('Informe o nome da pasta.');
      return;
    }
    if (!clientId) {
      toast.error('Selecione um cliente.');
      return;
    }

    try {
      setCreatingFolder(true);
      await DriveService.createFolder({
        clientId,
        parentId: currentFolderId || rootFolderId,
        name: folderName,
      });
      setNewFolderName('');
      setShowCreateFolderInput(false);
      toast.success('Pasta criada com sucesso.');
      await fetchFolder({
        folderId: currentFolderId || rootFolderId,
        breadcrumbOverride: breadcrumbs,
        preserveBreadcrumb: true,
      });
    } catch (error: any) {
      toast.error(getDriveErrorMessage(error, 'Erro ao criar pasta no Drive.'));
    } finally {
      setCreatingFolder(false);
    }
  };

  const visibleFiles = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return files;
    return files.filter((item) => {
      const indexable = `${item.name} ${getTypeLabel(item)}`.toLowerCase();
      return indexable.includes(query);
    });
  }, [files, searchTerm]);

  const visibleImageFiles = React.useMemo(
    () => visibleFiles.filter((item) => !item.isFolder && item.mimeType.startsWith('image/')),
    [visibleFiles]
  );

  const lightboxIndex = React.useMemo(
    () => visibleImageFiles.findIndex((item) => item.id === lightboxFileId),
    [visibleImageFiles, lightboxFileId]
  );

  const lightboxItem = lightboxIndex >= 0 ? visibleImageFiles[lightboxIndex] : null;

  const lightboxSources = React.useMemo(() => {
    if (!lightboxItem) return [];
    const id = encodeURIComponent(lightboxItem.id);
    return [
      `https://drive.google.com/thumbnail?id=${id}&sz=w3000`,
      `https://drive.google.com/uc?export=view&id=${id}`,
      lightboxItem.link || '',
    ].filter((src) => src.length > 0);
  }, [lightboxItem]);

  const closeLightbox = React.useCallback(() => {
    setLightboxFileId(null);
    setLightboxSourceIndex(0);
  }, []);

  const goPrevImage = React.useCallback(() => {
    if (!visibleImageFiles.length || lightboxIndex < 0) return;
    const nextIndex = (lightboxIndex - 1 + visibleImageFiles.length) % visibleImageFiles.length;
    setLightboxFileId(visibleImageFiles[nextIndex].id);
    setLightboxSourceIndex(0);
  }, [lightboxIndex, visibleImageFiles]);

  const goNextImage = React.useCallback(() => {
    if (!visibleImageFiles.length || lightboxIndex < 0) return;
    const nextIndex = (lightboxIndex + 1) % visibleImageFiles.length;
    setLightboxFileId(visibleImageFiles[nextIndex].id);
    setLightboxSourceIndex(0);
  }, [lightboxIndex, visibleImageFiles]);

  React.useEffect(() => {
    if (!lightboxItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLightbox();
      } else if (event.key === 'ArrowLeft') {
        goPrevImage();
      } else if (event.key === 'ArrowRight') {
        goNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [lightboxItem, closeLightbox, goPrevImage, goNextImage]);

  const effectiveViewMode = isMobile ? 'list' : viewMode;
  const viewportClass = 'max-h-[52vh] overflow-y-auto drive-scrollbar pr-1';

  return (
    <section className="premium-card p-3 md:p-4 space-y-3">
      <div className="rounded-xl border border-border bg-background p-3 space-y-2.5">
        <div className="flex flex-col xl:flex-row xl:items-center gap-2.5">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar arquivos..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'name' | 'date')}
              className="h-9 px-3 rounded-xl border border-border bg-card text-[11px] font-semibold uppercase tracking-wide text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="name" className="bg-card text-foreground">
                Nome
              </option>
              <option value="date" className="bg-card text-foreground">
                Data
              </option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
              className="h-9 px-3 rounded-xl border border-border bg-card text-[11px] font-semibold uppercase tracking-wide text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="desc" className="bg-card text-foreground">
                Decrescente
              </option>
              <option value="asc" className="bg-card text-foreground">
                Crescente
              </option>
            </select>

            <button
              type="button"
              onClick={() => setShowCreateFolderInput((state) => !state)}
              className="h-9 px-3 rounded-xl border border-border bg-card text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-1.5"
            >
              <FolderPlus size={14} />
              Nova Pasta
            </button>

            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="h-9 px-3 rounded-xl border border-border bg-card text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-1.5"
            >
              <Upload size={14} />
              Upload
            </button>

            <button
              type="button"
              onClick={() =>
                void fetchFolder({
                  folderId: currentFolderId || rootFolderId,
                  breadcrumbOverride: breadcrumbs,
                  preserveBreadcrumb: true,
                })
              }
              className="h-9 px-3 rounded-xl border border-border bg-card text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw size={14} />
              Atualizar
            </button>
          </div>
        </div>

        <Breadcrumb items={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />

        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center rounded-xl border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'h-7 px-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors',
                effectiveViewMode === 'grid'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Grid3X3 size={12} />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'h-7 px-2.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-colors',
                effectiveViewMode === 'list'
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <LayoutList size={12} />
              Lista
            </button>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {visibleFiles.length} item(ns)
          </span>
        </div>
      </div>

      {showCreateFolderInput && (
        <div className="rounded-xl border border-border bg-background p-3 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="NOME DA PASTA"
            className="h-9 flex-1 px-3 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={handleCreateFolder}
            disabled={creatingFolder}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wide hover:opacity-90 disabled:opacity-65"
          >
            {creatingFolder ? 'Criando...' : 'Criar Pasta'}
          </button>
        </div>
      )}

      {/* Barra de Progresso Global */}
      <AnimatePresence>
        {uploading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="premium-card mb-6 space-y-3 border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 animate-pulse">
                  <Rocket className="text-primary" size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Sincronizando com Drive...</h4>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Enviando arquivos selecionados</p>
                </div>
              </div>
              <span className="text-xl font-semibold tracking-tight text-primary">
                {Math.round(uploadProgress)}%
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden border border-border/50 p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary rounded-full relative"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:24px_24px] animate-[progress-stripe_1s_linear_infinite]" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UploadDropzone onFiles={handleUpload} disabled={!clientId || uploading || loading} />

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const fileList = event.target.files;
          if (!fileList || !fileList.length) return;
          void handleUpload(Array.from(fileList));
          event.currentTarget.value = '';
        }}
      />

      {loading ? (
        <div className={viewportClass}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3">
            {Array.from({ length: 12 }).map((_, index) => (
              <div key={index} className="h-[128px] rounded-xl border border-border bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      ) : visibleFiles.length === 0 ? (
        <div className="rounded-xl border border-border bg-background p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground">Nenhum arquivo encontrado</p>
          <p className="text-xs text-muted-foreground mt-2">A pasta está vazia ou o filtro não retornou resultados.</p>
        </div>
      ) : effectiveViewMode === 'grid' ? (
        <div className={cn(viewportClass, uploading && 'opacity-75')}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-3">
            {visibleFiles.map((item) => (
              <FileCard
                key={item.id}
                item={item}
                onOpen={handleOpenItem}
                onDownload={handleDownloadItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className={cn('rounded-xl border border-border bg-background overflow-hidden', viewportClass)}>
          <div className="overflow-x-auto drive-scrollbar">
            <table className="min-w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Nome
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Tipo
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Tamanho
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Data
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleFiles.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-t border-border hover:bg-muted/35 transition-colors cursor-pointer"
                    onClick={() => void handleOpenItem(item)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-foreground uppercase truncate max-w-[420px]" title={item.name}>
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{getTypeLabel(item)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.isFolder ? '-' : formatBytes(item.size)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {item.modifiedTime ? formatDate(item.modifiedTime) : '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleOpenItem(item);
                          }}
                          className="h-7 px-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[10px] uppercase"
                        >
                          <ExternalLink size={11} />
                          Abrir
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDownloadItem(item);
                          }}
                          className="h-7 px-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[10px] uppercase"
                          disabled={item.isFolder}
                        >
                          <Download size={11} />
                          Baixar
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteItem(item);
                          }}
                          className="h-7 w-7 rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive inline-flex items-center justify-center"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lightboxItem && (
        <div
          className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <div
            className="w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-12 px-4 border-b border-border flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground truncate">{lightboxItem.name}</p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={goPrevImage}
                  className="h-8 w-8 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
                  title="Imagem anterior"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={goNextImage}
                  className="h-8 w-8 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
                  title="Próxima imagem"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadItem(lightboxItem)}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground text-[10px] font-semibold uppercase tracking-wide inline-flex items-center gap-1"
                >
                  <Download size={12} />
                  Baixar
                </button>
                <button
                  type="button"
                  onClick={() => lightboxItem.link && window.open(lightboxItem.link, '_blank', 'noopener,noreferrer')}
                  className="h-8 px-2.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground text-[10px] font-semibold uppercase tracking-wide inline-flex items-center gap-1"
                >
                  <ExternalLink size={12} />
                  Drive
                </button>
                <button
                  type="button"
                  onClick={closeLightbox}
                  className="h-8 w-8 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground inline-flex items-center justify-center"
                  title="Fechar"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="h-[72vh] bg-background p-3 flex items-center justify-center">
              {lightboxSources.length > 0 ? (
                <img
                  src={lightboxSources[Math.min(lightboxSourceIndex, lightboxSources.length - 1)]}
                  alt={lightboxItem.name}
                  className="max-h-full max-w-full object-contain rounded-lg border border-border"
                  onError={() =>
                    setLightboxSourceIndex((current) =>
                      current < lightboxSources.length - 1 ? current + 1 : current
                    )
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">Não foi possível carregar a visualização.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
