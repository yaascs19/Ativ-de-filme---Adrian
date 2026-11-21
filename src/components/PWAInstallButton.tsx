import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  MoreVertical,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

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
      if (accepted) return;
    }
    setCopiedUrl(false);
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Ignora caso a área de transferência esteja bloqueada
    }
  };

  const modalContent =
    showGuideModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#090D16]/75 p-4 backdrop-blur-sm"
            onClick={() => setShowGuideModal(false)}
          >
            <div
              className="my-auto w-full max-w-md rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-6 shadow-2xl"
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
                <div className="mt-4 space-y-2 rounded-xl border border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] px-3.5 py-3 text-xs leading-relaxed text-[var(--cr-accent-text)]">
                  <p>
                    Você está vendo o site dentro de uma janela de prévia. Para instalar no
                    celular ou computador, abra o endereço publicado direto no Chrome ou
                    Safari.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[var(--cr-accent-border)] bg-[var(--cr-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cr-ink)] hover:opacity-90 cursor-pointer"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#059669]" aria-hidden="true" />
                        <span>Link copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Copiar link do site</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {isIOS ? (
                <ol className="mt-4 space-y-2.5 text-xs leading-relaxed text-[var(--cr-ink-secondary)]">
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-bold text-[var(--cr-accent)]">1.</span>
                    <span>
                      Abra o site no <strong className="text-[var(--cr-ink)]">Safari</strong>{' '}
                      (ou toque em{' '}
                      <strong className="inline-flex items-center gap-1 text-[var(--cr-ink)]">
                        Compartilhar <Share className="h-3.5 w-3.5" aria-hidden="true" />
                      </strong>{' '}
                      na barra do navegador).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono font-bold text-[var(--cr-accent)]">2.</span>
                    <span>
                      Role para baixo e toque em{' '}
                      <strong className="text-[var(--cr-ink)]">
                        Adicionar à Tela de Início
                      </strong>
                      .
                    </span>
                  </li>
                </ol>
              ) : (
                <div className="mt-4 space-y-3">
                  <ol className="space-y-2.5 text-xs leading-relaxed text-[var(--cr-ink-secondary)]">
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-bold text-[var(--cr-accent)]">1.</span>
                      <span>
                        Abra em uma aba normal (não anônima) direto no{' '}
                        <strong className="text-[var(--cr-ink)]">Chrome</strong> ou{' '}
                        <strong className="text-[var(--cr-ink)]">Edge</strong> (se abriu pelo
                        WhatsApp/Instagram, escolha <em>“Abrir no Chrome”</em>).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-mono font-bold text-[var(--cr-accent)]">2.</span>
                      <span>
                        No celular, toque nos{' '}
                        <strong className="inline-flex items-center gap-0.5 text-[var(--cr-ink)]">
                          3 pontinhos <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                        </strong>{' '}
                        e selecione{' '}
                        <strong className="text-[var(--cr-ink)]">Adicionar à tela inicial</strong>{' '}
                        ou{' '}
                        <strong className="text-[var(--cr-ink)]">Instalar aplicativo</strong>. No
                        PC, clique no ícone de instalação na barra de endereço.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="mt-5 min-h-[40px] w-full rounded-xl bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

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

      {modalContent}
    </>
  );
}
