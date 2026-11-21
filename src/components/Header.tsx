import { Bookmark, Film, LogIn, MessageCircle, Plus, User } from 'lucide-react';
import { AuthUser } from '../types/cinema';
import { BrandMark } from './BrandMark';
import { PWAInstallButton } from './PWAInstallButton';

export type MobileView = 'catalogo' | 'lista' | 'chat';

interface HeaderProps {
  activeView: MobileView;
  onSelectView: (view: MobileView) => void;
  watchlistCount: number;
  chatMessagesCount: number;
  authUser: AuthUser | null;
  onOpenAuthModal: () => void;
  onOpenRecommendModal: () => void;
}

export function Header({
  activeView,
  onSelectView,
  watchlistCount,
  chatMessagesCount,
  authUser,
  onOpenAuthModal,
  onOpenRecommendModal,
}: HeaderProps) {
  const navItems: Array<{
    id: MobileView;
    label: string;
    icon: typeof Film;
  }> = [
    { id: 'catalogo', label: 'Catálogo', icon: Film },
    { id: 'lista', label: `Minha Lista (${watchlistCount})`, icon: Bookmark },
    { id: 'chat', label: `Comunidade (${chatMessagesCount})`, icon: MessageCircle },
  ];

  const firstName = authUser ? authUser.name.split(' ')[0] : '';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--cr-border)] bg-[var(--cr-header-bg)] backdrop-blur-md">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6">
        {/* Zona 1: Marca única em uma linha */}
        <button
          type="button"
          onClick={() => onSelectView('catalogo')}
          className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[var(--cr-ink)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cr-accent)] rounded"
        >
          <BrandMark className="h-7 w-7 shrink-0" />
          <span>
            Cine<span className="text-[var(--cr-accent)]">Roda</span>
          </span>
        </button>

        {/* Zona 2: Links de navegação em linha única */}
        <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative inline-flex items-center gap-2 py-1 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cr-accent)] rounded ${
                  isActive
                    ? 'text-[var(--cr-accent)] font-semibold'
                    : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[14px] h-0.5 bg-[var(--cr-accent)]"
                  />
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenAuthModal}
            className="inline-flex items-center gap-2 py-1 text-sm font-medium text-[var(--cr-ink-secondary)] transition-colors duration-150 hover:text-[var(--cr-ink)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cr-accent)] rounded"
          >
            {authUser ? (
              <>
                <User className="h-4 w-4 shrink-0 text-[var(--cr-accent)]" aria-hidden="true" />
                <span className="max-w-[120px] truncate">{firstName}</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Entrar</span>
              </>
            )}
          </button>
        </nav>

        {/* Zona 3: Ação principal + botão condicional de instalação PWA */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={onOpenRecommendModal}
            style={{ boxShadow: '0 2px 10px -2px var(--cr-accent-shadow)' }}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--cr-accent)] px-4 py-2 text-xs font-semibold text-white transition-all duration-150 hover:bg-[var(--cr-accent-hover)] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cr-accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Indicar Filme</span>
          </button>
        </div>
      </div>

      {/* Navegação móvel e tablet compacta */}
      <nav
        aria-label="Navegação móvel"
        className="flex lg:hidden items-center gap-1.5 overflow-x-auto border-t border-[var(--cr-border)] bg-[var(--cr-surface-alt)] px-4 py-1.5"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                isActive
                  ? 'bg-[var(--cr-surface)] text-[var(--cr-accent)] font-semibold shadow-xs'
                  : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenAuthModal}
          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)] whitespace-nowrap shrink-0 cursor-pointer"
        >
          {authUser ? (
            <>
              <User className="h-3.5 w-3.5 shrink-0 text-[var(--cr-accent)]" aria-hidden="true" />
              <span className="max-w-[90px] truncate">{firstName}</span>
            </>
          ) : (
            <>
              <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Entrar</span>
            </>
          )}
        </button>
      </nav>
    </header>
  );
}
