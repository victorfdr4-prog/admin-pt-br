import { X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AppSidebar } from './AppSidebar';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  const location = useLocation();

  // Close drawer when route changes
  useEffect(() => {
    onClose();
  }, [location.pathname, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 z-50 h-full w-64 transform bg-surface transition-transform duration-200 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-text-primary">Cromia</h2>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center p-1 rounded-md hover:bg-card transition-colors"
              aria-label="Fechar menu"
            >
              <X size={24} className="text-text-primary" />
            </button>
          </div>

          {/* Nav Content */}
          <div className="flex-1 overflow-y-auto">
            <AppSidebar />
          </div>
        </div>
      </div>
    </>
  );
}
