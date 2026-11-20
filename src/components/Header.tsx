import { Plus } from 'lucide-react';

export type MobileView = 'catalogo' | 'lista' | 'chat';

interface HeaderProps {
  activeView: MobileView;
  onSelectView: (view: MobileView) => void;
  watchlistCount: number;
  chatMessagesCount: number;
  onOpenRecommendModal: () => void;
}

export function Header({
  activeView,
  onSelectView,
  watchlistCount,
  chatMessagesCount,
  onOpenRecommendModal,
}: HeaderProps) {
  const navItems: Array<{ id: MobileView; label: string; hideOnDesktop?: boolean }> = [
    { id: 'catalogo', label: 'Catálogo' },
    { id: 'lista', label: `Minha Lista (${watchlistCount})` },
    { id: 'chat', label: `Chat (${chatMessagesCount})`, hideOnDesktop: true },
  ];

  return (
    <header className="border-b border-[#E2E8F0] bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3.5 sm:gap-8 sm:px-6">
        {/* Zona 1: Marca única em uma linha */}
        <button
          type="button"
          onClick={() => onSelectView('catalogo')}
          className="font-display text-xl font-bold tracking-tight text-[#111827] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E11D48] rounded"
        >
          CineRoda
        </button>

        {/* Zona 2: Links de navegação em linha única */}
        <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-7">
          {navItems
            .filter((item) => !item.hideOnDesktop)
            .map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E11D48] rounded ${
                    isActive
                      ? 'text-[#E11D48] font-semibold'
                      : 'text-[#475569] hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-[#E11D48]"
                    />
                  )}
                </button>
              );
            })}
        </nav>

        {/* Zona 3: Ação principal única */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenRecommendModal}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#E11D48] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#BE123C] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E11D48]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Indicar Filme</span>
          </button>
        </div>
      </div>

      {/* Navegação móvel compacta */}
      <nav
        aria-label="Navegação móvel"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-1.5"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`min-h-[38px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                isActive
                  ? 'bg-white text-[#E11D48] font-semibold shadow-xs border border-[#E2E8F0]'
                  : 'text-[#475569] hover:text-[#111827]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
