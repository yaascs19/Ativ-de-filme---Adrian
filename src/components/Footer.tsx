const PALETTE_SWATCHES = [
  { name: 'Papel Claro', hex: '#F8F9FB' },
  { name: 'Branco', hex: '#FFFFFF' },
  { name: 'Ardósia Escura', hex: '#111827' },
  { name: 'Cinábrio Cinema', hex: '#E11D48' },
  { name: 'Esmeralda', hex: '#059669' },
];

export function Footer() {
  return (
    <footer className="mt-14 border-t border-[#E2E8F0] bg-white">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="font-display text-sm font-semibold text-[#111827]">
            CineRoda · Catálogo Colaborativo de Filmes (DSA 2026)
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            ReactJS com API Serverless (Vercel + SQL Server) e lista pessoal sincronizada no navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2" aria-label="Paleta de cores Adobe Color">
            <span className="text-xs font-medium text-[#64748B]">Paleta:</span>
            <div className="flex items-center gap-1.5">
              {PALETTE_SWATCHES.map((swatch) => (
                <span
                  key={swatch.hex}
                  title={`${swatch.name} (${swatch.hex})`}
                  className="h-4 w-4 rounded-sm border border-[#CBD5E1]"
                  style={{ backgroundColor: swatch.hex }}
                />
              ))}
            </div>
          </div>

          <span aria-hidden="true" className="text-[#CBD5E1]">
            |
          </span>

          <div className="flex items-center gap-4 text-xs font-medium text-[#475569]">
            <a
              href="https://pt-br.react.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#E11D48] hover:underline whitespace-nowrap shrink-0"
            >
              React Docs
            </a>
            <a
              href="https://developer.mozilla.org/pt-BR/docs/Web/JavaScript"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#E11D48] hover:underline whitespace-nowrap shrink-0"
            >
              MDN JavaScript
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
