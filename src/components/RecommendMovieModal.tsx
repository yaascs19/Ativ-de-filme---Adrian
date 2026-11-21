import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, Upload, UserCheck, X } from 'lucide-react';
import { GENRES, getDefaultPosterForGenre, POSTER_PRESETS } from '../data/posters';
import { AuthUser, MovieGenre, MovieItem } from '../types/cinema';

interface RecommendMovieModalProps {
  isOpen: boolean;
  authUser: AuthUser | null;
  authHeaders: Record<string, string>;
  onClose: () => void;
  onMovieCreated: (movie: MovieItem, shareInChat: boolean) => void;
}

export function RecommendMovieModal({
  isOpen,
  authUser,
  authHeaders,
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
  const [recommendationNote, setRecommendationNote] = useState('');
  const [uploadedPosterDataUrl, setUploadedPosterDataUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const [presetPosterUrl, setPresetPosterUrl] = useState(
    getDefaultPosterForGenre('Romance')
  );
  const [shareInChat, setShareInChat] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !authUser) return null;

  const effectivePosterUrl = uploadedPosterDataUrl || presetPosterUrl;

  const handleGenreChange = (nextGenre: MovieGenre) => {
    setGenre(nextGenre);
    if (!uploadedPosterDataUrl) {
      setPresetPosterUrl(getDefaultPosterForGenre(nextGenre));
    }
  };

  const handleSelectImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).');
      e.target.value = '';
      return;
    }

    setErrorMsg('');
    setProcessingImage(true);
    try {
      const compressedDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Falha ao ler a imagem.'));
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => reject(new Error('Formato de imagem não suportado.'));
          img.onload = () => {
            const maxW = 480;
            const maxH = 640;
            const scale = Math.min(1, maxW / img.width, maxH / img.height);
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Não foi possível processar a imagem.'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            let dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            if (dataUrl.length > 260_000) {
              dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            }
            resolve(dataUrl);
          };
          img.src = String(reader.result || '');
        };
        reader.readAsDataURL(file);
      });

      setUploadedPosterDataUrl(compressedDataUrl);
      setUploadedFileName(file.name);
    } catch {
      setErrorMsg('Não foi possível abrir essa imagem. Tente outra foto (JPG ou PNG).');
    } finally {
      setProcessingImage(false);
      e.target.value = '';
    }
  };

  const handleClearUploadedImage = () => {
    setUploadedPosterDataUrl('');
    setUploadedFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

    setSubmitting(true);
    try {
      const response = await fetch('/api/movies', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({
          title: title.trim(),
          director: director.trim(),
          year: Number(year),
          durationMinutes: Number(durationMinutes),
          genre,
          rating: Number(rating),
          synopsis: synopsis.trim(),
          recommendationNote: recommendationNote.trim(),
          posterUrl: effectivePosterUrl,
        }),
      });

      const data = (await response.json()) as { movie?: MovieItem; error?: string };
      if (!response.ok || !data.movie) {
        setErrorMsg(data.error || 'Não foi possível salvar a indicação.');
        return;
      }

      onMovieCreated(data.movie, shareInChat);
      setTitle('');
      setDirector('');
      setSynopsis('');
      setRecommendationNote('');
      handleClearUploadedImage();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cr-border)] pb-4">
          <div>
            <h2
              id="recommend-modal-title"
              className="font-display text-xl font-bold text-[var(--cr-ink)]"
            >
              Indicar Novo Filme para o Catálogo
            </h2>
            <p className="mt-1 text-xs text-[var(--cr-ink-muted)]">
              Escolha uma imagem do seu computador ou selecione uma capa pronta abaixo.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cr-border)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="mov-title"
                className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
              >
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
                className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="mov-director"
                className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
              >
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
                className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-2">
              <label
                htmlFor="mov-genre"
                className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
              >
                Gênero
              </label>
              <select
                id="mov-genre"
                value={genre}
                onChange={(e) => handleGenreChange(e.target.value as MovieGenre)}
                className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] focus:border-[var(--cr-accent)] focus:outline-none"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="mov-year"
                className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
              >
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
                className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 font-mono text-sm text-[var(--cr-ink)] tabular-nums focus:border-[var(--cr-accent)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="mov-duration"
                className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
              >
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
                className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 font-mono text-sm text-[var(--cr-ink)] tabular-nums focus:border-[var(--cr-accent)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-semibold text-[var(--cr-ink-secondary)]">
                Indicado pela conta
              </span>
              <div className="mt-1.5 flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface-alt)] px-3 py-2 text-sm font-medium text-[var(--cr-ink)]">
                <UserCheck className="h-4 w-4 shrink-0 text-[#059669]" aria-hidden="true" />
                <span className="truncate">{authUser.name}</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="mov-rating"
                className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
              >
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
                className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 font-mono text-sm text-[var(--cr-ink)] tabular-nums focus:border-[var(--cr-accent)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="mov-synopsis"
              className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
            >
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
              className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="mov-note"
              className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
            >
              Por que você indica esse filme?
            </label>
            <input
              id="mov-note"
              type="text"
              maxLength={240}
              value={recommendationNote}
              onChange={(e) => setRecommendationNote(e.target.value)}
              placeholder="Ex.: Roteiro muito criativo e ótimo final!"
              className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
            />
          </div>

          {/* Seleção de imagem do computador com pré-visualização */}
          <div className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] p-3.5 space-y-3">
            <div className="flex items-center gap-3.5">
              <div className="h-20 w-15 shrink-0 overflow-hidden rounded-lg border border-[var(--cr-border-strong)] bg-[#0F172A] flex items-center justify-center">
                {effectivePosterUrl ? (
                  <img
                    src={effectivePosterUrl}
                    alt="Pré-visualização do pôster"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <span className="block text-xs font-semibold text-[var(--cr-ink-secondary)]">
                  Imagem do pôster do filme
                </span>

                <input
                  ref={fileInputRef}
                  id="mov-poster-file"
                  type="file"
                  accept="image/*"
                  onChange={handleSelectImageFile}
                  className="sr-only"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={processingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--cr-ink)] transition-colors hover:border-[var(--cr-accent)] hover:text-[var(--cr-accent)] cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      {processingImage
                        ? 'Carregando imagem...'
                        : uploadedPosterDataUrl
                          ? 'Trocar imagem'
                          : 'Abrir imagem do computador'}
                    </span>
                  </button>

                  {uploadedPosterDataUrl && (
                    <button
                      type="button"
                      onClick={handleClearUploadedImage}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3 py-2 text-xs font-medium text-[var(--cr-ink-muted)] hover:text-[#DC2626] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remover</span>
                    </button>
                  )}
                </div>

                {uploadedFileName ? (
                  <p className="truncate text-[11px] font-medium text-[#059669] dark:text-emerald-400">
                    Arquivo selecionado: {uploadedFileName}
                  </p>
                ) : (
                  <p className="text-[11px] text-[var(--cr-ink-muted)]">
                    Aceita JPG, PNG ou WebP direto do seu computador ou celular.
                  </p>
                )}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-medium text-[var(--cr-ink-muted)]">
                Ou escolha uma capa pronta:
              </span>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {POSTER_PRESETS.map((preset) => {
                  const selected = !uploadedPosterDataUrl && presetPosterUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        handleClearUploadedImage();
                        setPresetPosterUrl(preset.url);
                      }}
                      className={`overflow-hidden rounded-lg border text-left transition-all cursor-pointer ${
                        selected
                          ? 'border-[var(--cr-accent)] ring-2 ring-[var(--cr-accent)]'
                          : 'border-[var(--cr-border)] opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="aspect-[3/4] w-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-[var(--cr-ink-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={shareInChat}
              onChange={(e) => setShareInChat(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--cr-accent)]"
            />
            <span>Anunciar minha indicação automaticamente no chat da comunidade</span>
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-[var(--cr-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-2 text-xs font-semibold text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] rounded-lg bg-[var(--cr-accent)] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--cr-accent-hover)] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Salvando...' : 'Publicar Indicação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
