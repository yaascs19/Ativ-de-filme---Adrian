import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useBodyScrollLock(showIOSGuide);

  useEffect(() => {
    if (!showIOSGuide) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowIOSGuide(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showIOSGuide]);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Instalar CineRoda como aplicativo"
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3 py-2 text-xs font-semibold text-[var(--cr-ink)] transition-colors hover:border-[var(--cr-accent-border)] hover:text-[var(--cr-accent)] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5 text-[var(--cr-accent)]" aria-hidden="true" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Adicionar CineRoda à tela inicial"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3 py-2 text-xs font-semibold text-[var(--cr-ink)] transition-colors hover:border-[var(--cr-accent-border)] hover:text-[var(--cr-accent)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-[var(--cr-accent)]" aria-hidden="true" />
          <span className="hidden sm:inline">Instalar App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 p-4 backdrop-blur-sm"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="ios-install-title"
                  className="font-display text-lg font-bold text-[var(--cr-ink)]"
                >
                  Instalar CineRoda no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar instruções"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cr-border)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-[var(--cr-ink-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[var(--cr-accent)]">1.</span>
                  <span>
                    Toque no botão{' '}
                    <strong className="inline-flex items-center gap-1 text-[var(--cr-ink)]">
                      Compartilhar <Share className="h-3.5 w-3.5" aria-hidden="true" />
                    </strong>{' '}
                    na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[var(--cr-accent)]">2.</span>
                  <span>
                    Role para baixo e toque em{' '}
                    <strong className="text-[var(--cr-ink)]">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[40px] w-full rounded-xl bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
