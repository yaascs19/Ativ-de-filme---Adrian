import { FormEvent, useEffect, useState } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import { GENRES, getDefaultPosterForGenre, POSTER_PRESETS } from '../data/posters';
import { MovieGenre, MovieItem } from '../types/cinema';

interface RecommendMovieModalProps {
  isOpen: boolean;
  defaultAuthorName: string;
  clientId: string;
  onClose: () => void;
  onMovieCreated: (movie: MovieItem, shareInChat: boolean, authorName: string) => void;
}

export function RecommendMovieModal({
  isOpen,
  defaultAuthorName,
  clientId,
  onClose,
  onMovieCreated,
}: RecommendMovieModalProps) {
  const [title, setTitle] = useState('');
  const [director, setDirector] = useState('');
  const [year, setYear] = useState('2025');
  const [durationMinutes, setDurationMinutes] = useState('115');
  const [genre, setGenre] = useState<MovieGenre>('Romance');
  const [rating, setRating] = useState('4.5');
  const [synopsis, setSynopsis] = useState('');
  const [recommendedBy, setRecommendedBy] = useState(defaultAuthorName);
  const [recommendationNote, setRecommendationNote] = useState('');
  const [customPosterUrl, setCustomPosterUrl] = useState('');
  const [customPosterInvalid, setCustomPosterInvalid] = useState(false);
  const [presetPosterUrl, setPresetPosterUrl] = useState(
    getDefaultPosterForGenre('Romance')
  );
  const [shareInChat, setShareInChat] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && defaultAuthorName && !recommendedBy) {
      setRecommendedBy(defaultAuthorName);
    }
  }, [isOpen, defaultAuthorName, recommendedBy]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const trimmedCustomUrl = customPosterUrl.trim();
  const effectivePosterUrl =
    trimmedCustomUrl && !customPosterInvalid ? trimmedCustomUrl : presetPosterUrl;

  const handleGenreChange = (nextGenre: MovieGenre) => {
    setGenre(nextGenre);
    setPresetPosterUrl(getDefaultPosterForGenre(nextGenre));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (title.trim().length < 2 || director.trim().length < 2) {
      setErrorMsg('Informe o título do filme e o nome da direção.');
      return;
    }
    if (synopsis.trim().length < 10) {
      setErrorMsg('Escreva uma sinopse com pelo menos 10 caracteres.');
      return;
    }
    if (recommendedBy.trim().length < 2) {
      setErrorMsg('Informe seu nome para assinar a indicação.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          director: director.trim(),
          year: Number(year),
          durationMinutes: Number(durationMinutes),
          genre,
          rating: Number(rating),
          synopsis: synopsis.trim(),
          recommendedBy: recommendedBy.trim(),
          recommendationNote: recommendationNote.trim(),
          posterUrl: effectivePosterUrl,
          clientId,
        }),
      });

      const data = (await response.json()) as { movie?: MovieItem; error?: string };
      if (!response.ok || !data.movie) {
        setErrorMsg(data.error || 'Não foi possível salvar a indicação.');
        return;
      }

      onMovieCreated(data.movie, shareInChat, recommendedBy.trim());
      setTitle('');
      setDirector('');
      setSynopsis('');
      setRecommendationNote('');
      setCustomPosterUrl('');
      setCustomPosterInvalid(false);
      onClose();
    } catch {
      setErrorMsg('Erro de conexão com o servidor ao salvar o filme.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recommend-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/70 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
          <div>
            <h2
              id="recommend-modal-title"
              className="font-display text-xl font-bold text-[#111827]"
            >
              Indicar Novo Filme para o Catálogo
            </h2>
            <p className="mt-1 text-xs text-[#64748B]">
              Cadastre qualquer filme com imagem própria ou escolha uma capa sugerida.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B]"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mov-title" className="block text-xs font-semibold text-[#334155]">
                Título do filme
              </label>
              <input
                id="mov-title"
                type="text"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Interestelar"
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#111827] focus:border-[#E11D48] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="mov-director" className="block text-xs font-semibold text-[#334155]">
                Direção
              </label>
              <input
                id="mov-director"
                type="text"
                required
                maxLength={80}
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                placeholder="Ex.: Christopher Nolan"
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#111827] focus:border-[#E11D48] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-2">
              <label htmlFor="mov-genre" className="block text-xs font-semibold text-[#334155]">
                Gênero
              </label>
              <select
                id="mov-genre"
                value={genre}
                onChange={(e) => handleGenreChange(e.target.value as MovieGenre)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#E11D48] focus:outline-none"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="mov-year" className="block text-xs font-semibold text-[#334155]">
                Ano
              </label>
              <input
                id="mov-year"
                type="number"
                min={1900}
                max={2030}
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 font-mono text-sm text-[#111827] tabular-nums focus:border-[#E11D48] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="mov-duration" className="block text-xs font-semibold text-[#334155]">
                Duração (min)
              </label>
              <input
                id="mov-duration"
                type="number"
                min={30}
                max={400}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 font-mono text-sm text-[#111827] tabular-nums focus:border-[#E11D48] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="mov-author" className="block text-xs font-semibold text-[#334155]">
                Seu nome
              </label>
              <input
                id="mov-author"
                type="text"
                required
                maxLength={40}
                value={recommendedBy}
                onChange={(e) => setRecommendedBy(e.target.value)}
                placeholder="Como deseja aparecer"
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#111827] focus:border-[#E11D48] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="mov-rating" className="block text-xs font-semibold text-[#334155]">
                Sua nota (1 a 5)
              </label>
              <input
                id="mov-rating"
                type="number"
                min={1}
                max={5}
                step={0.1}
                required
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 font-mono text-sm text-[#111827] tabular-nums focus:border-[#E11D48] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mov-synopsis" className="block text-xs font-semibold text-[#334155]">
              Sinopse breve
            </label>
            <textarea
              id="mov-synopsis"
              rows={2}
              required
              maxLength={400}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              placeholder="Sobre o que é o filme sem spoilers..."
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#111827] focus:border-[#E11D48] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="mov-note" className="block text-xs font-semibold text-[#334155]">
              Por que você indica esse filme?
            </label>
            <input
              id="mov-note"
              type="text"
              maxLength={240}
              value={recommendationNote}
              onChange={(e) => setRecommendationNote(e.target.value)}
              placeholder="Ex.: Roteiro muito criativo e ótimo final!"
              className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] px-3 py-2 text-sm text-[#111827] focus:border-[#E11D48] focus:outline-none"
            />
          </div>

          {/* URL de imagem real com pré-visualização */}
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-[#CBD5E1] bg-[#0F172A] flex items-center justify-center">
                {effectivePosterUrl ? (
                  <img
                    src={effectivePosterUrl}
                    alt="Pré-visualização do pôster"
                    referrerPolicy="no-referrer"
                    onLoad={() => setCustomPosterInvalid(false)}
                    onError={() => {
                      if (trimmedCustomUrl) setCustomPosterInvalid(true);
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <label
                  htmlFor="mov-poster-url"
                  className="block text-xs font-semibold text-[#334155]"
                >
                  Link da imagem do pôster (opcional)
                </label>
                <input
                  id="mov-poster-url"
                  type="url"
                  maxLength={500}
                  value={customPosterUrl}
                  onChange={(e) => {
                    setCustomPosterUrl(e.target.value);
                    setCustomPosterInvalid(false);
                  }}
                  placeholder="https://exemplo.com/poster-do-filme.jpg"
                  className="mt-1.5 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs text-[#111827] focus:border-[#E11D48] focus:outline-none"
                />
                {customPosterInvalid && trimmedCustomUrl && (
                  <p className="mt-1 text-[11px] text-[#DC2626]">
                    Não foi possível carregar esse link. Será usada a capa selecionada abaixo.
                  </p>
                )}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-[#64748B]">
                Ou escolha uma capa fotográfica pronta:
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {POSTER_PRESETS.map((preset) => {
                  const selected = !trimmedCustomUrl && presetPosterUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCustomPosterUrl('');
                        setCustomPosterInvalid(false);
                        setPresetPosterUrl(preset.url);
                      }}
                      className={`overflow-hidden rounded-lg border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-[#E11D48] ring-2 ring-[#E11D48]'
                          : 'border-[#E2E8F0] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="aspect-[3/4] w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-[#334155] cursor-pointer">
            <input
              type="checkbox"
              checked={shareInChat}
              onChange={(e) => setShareInChat(e.target.checked)}
              className="h-4 w-4 rounded accent-[#E11D48]"
            />
            <span>Anunciar minha indicação automaticamente no chat da comunidade</span>
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] rounded-lg bg-[#E11D48] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#BE123C] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Salvando...' : 'Publicar Indicação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
