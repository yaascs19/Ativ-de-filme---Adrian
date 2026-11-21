import { useEffect, useState } from 'react';
import { Download, MoreVertical, Share, Smartphone, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  useBodyScrollLock(showGuideModal);

  useEffect(() => {
    if (!showGuideModal) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuideModal(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showGuideModal]);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) return;
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Instalar CineRoda na tela inicial"
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3 py-2 text-xs font-semibold text-[var(--cr-ink)] transition-colors hover:border-[var(--cr-accent-border)] hover:text-[var(--cr-accent)] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download
          className="h-3.5 w-3.5 text-[var(--cr-accent)] shrink-0"
          aria-hidden="true"
        />
        <span className="sm:hidden">Instalar</span>
        <span className="hidden sm:inline">Instalar App</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 p-4 backdrop-blur-sm"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cr-accent-soft)] text-[var(--cr-accent)]">
                  <Smartphone className="h-4 w-4" aria-hidden="true" />
                </div>
                <h3
                  id="pwa-install-title"
                  className="font-display text-base font-bold text-[var(--cr-ink)]"
                >
                  Adicionar à Tela Inicial
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fechar instruções"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--cr-border)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {isInIframe && (
              <p className="mt-4 rounded-xl border border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--cr-accent-text)]">
                O navegador bloqueia a instalação dentro desta janela de prévia.
                Abra o link publicado da Vercel direto no Chrome ou Safari do celular.
              </p>
            )}

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-[var(--cr-ink-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[var(--cr-accent)]">1.</span>
                  <span>
                    No Safari, toque no botão{' '}
                    <strong className="inline-flex items-center gap-1 text-[var(--cr-ink)]">
                      Compartilhar <Share className="h-3.5 w-3.5" aria-hidden="true" />
                    </strong>{' '}
                    na barra inferior.
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
            ) : (
              <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-[var(--cr-ink-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[var(--cr-accent)]">1.</span>
                  <span>
                    No Chrome/Edge, toque no menu{' '}
                    <strong className="inline-flex items-center gap-0.5 text-[var(--cr-ink)]">
                      3 pontinhos <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                    </strong>{' '}
                    no canto superior direito (ou no ícone de instalação na barra de endereços no PC).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono font-bold text-[var(--cr-accent)]">2.</span>
                  <span>
                    Toque em{' '}
                    <strong className="text-[var(--cr-ink)]">
                      Instalar aplicativo
                    </strong>{' '}
                    ou{' '}
                    <strong className="text-[var(--cr-ink)]">
                      Adicionar à tela inicial
                    </strong>
                    .
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
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
