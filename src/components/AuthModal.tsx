import { FormEvent, useEffect, useState } from 'react';
import { Check, Eye, EyeOff, LogIn, LogOut, Pencil, UserCheck, UserPlus, X } from 'lucide-react';
import { AuthUser, ThemePaletteId, UserActivity } from '../types/cinema';

type AuthTab = 'login' | 'register';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: AuthTab;
  promptReason?: string;
  currentPalette: ThemePaletteId;
  authUser: AuthUser | null;
  authHeaders: Record<string, string>;
  watchlistCount: number;
  ratingsCount: number;
  authoredCount: number;
  onClose: () => void;
  onAuthSuccess: (user: AuthUser, activity: UserActivity, sessionToken?: string) => void;
  onProfileUpdated: (user: AuthUser) => void;
  onLogout: () => Promise<void>;
}

export function AuthModal({
  isOpen,
  initialTab = 'login',
  promptReason,
  currentPalette,
  authUser,
  authHeaders,
  watchlistCount,
  ratingsCount,
  authoredCount,
  onClose,
  onAuthSuccess,
  onProfileUpdated,
  onLogout,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edição de perfil
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setErrorMsg('');
      setProfileSuccess('');
      setEditingProfile(false);
      setCurrentPassword('');
      setNewPassword('');
      if (authUser) {
        setProfileName(authUser.name);
      }
    }
  }, [isOpen, initialTab, authUser]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Informe um e-mail válido.');
      return;
    }
    if (tab === 'register' && name.trim().length < 2) {
      setErrorMsg('Informe seu nome com pelo menos 2 caracteres.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        tab === 'register'
          ? { name: name.trim(), email: cleanEmail, password, palette: currentPalette }
          : { email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
        },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        user?: AuthUser;
        activity?: UserActivity;
        sessionToken?: string;
        error?: string;
      };

      if (!res.ok || !data.user || !data.activity) {
        setErrorMsg(data.error || 'Não foi possível concluir o acesso.');
        return;
      }

      setPassword('');
      onAuthSuccess(data.user, data.activity, data.sessionToken);
      onClose();
    } catch {
      setErrorMsg('Erro de conexão com o servidor ao autenticar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!authUser) return;
    setErrorMsg('');
    setProfileSuccess('');

    const trimmedName = profileName.trim();
    if (trimmedName.length < 2) {
      setErrorMsg('O nome deve ter pelo menos 2 caracteres.');
      return;
    }
    if (newPassword && !currentPassword) {
      setErrorMsg('Informe sua senha atual para definir uma nova senha.');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setErrorMsg('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (trimmedName === authUser.name && !newPassword) {
      setEditingProfile(false);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CineRoda',
          ...authHeaders,
        },
        body: JSON.stringify({
          name: trimmedName,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setErrorMsg(data.error || 'Não foi possível atualizar o perfil.');
        return;
      }

      onProfileUpdated(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setEditingProfile(false);
      setProfileSuccess('Perfil atualizado com sucesso.');
    } catch {
      setErrorMsg('Erro de conexão ao salvar seu perfil.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoutClick = async () => {
    setSubmitting(true);
    await onLogout();
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--cr-border)] bg-[var(--cr-surface)] p-6 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--cr-border)] pb-4">
          <div>
            <h2
              id="auth-modal-title"
              className="font-display text-xl font-bold text-[var(--cr-ink)]"
            >
              {authUser
                ? 'Sua Conta CineRoda'
                : tab === 'login'
                  ? 'Entrar na sua conta'
                  : 'Criar nova conta'}
            </h2>
            <p className="mt-1 text-xs text-[var(--cr-ink-muted)]">
              {authUser
                ? 'Sua lista, avaliações, indicações e paleta ficam salvas no seu login.'
                : 'Acesse com seu e-mail para salvar suas atividades em qualquer dispositivo.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de conta"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--cr-border)] text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {authUser ? (
          <div className="mt-5 space-y-5">
            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
              >
                {errorMsg}
              </div>
            )}

            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-xs font-medium text-[#065F46] dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <div className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cr-accent-soft)] text-[var(--cr-accent)]">
                    <UserCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--cr-ink)]">
                      {authUser.name}
                    </p>
                    <p className="truncate text-xs text-[var(--cr-ink-muted)]">
                      {authUser.email}
                    </p>
                  </div>
                </div>

                {!editingProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProfile(true);
                      setErrorMsg('');
                      setProfileSuccess('');
                    }}
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--cr-ink-secondary)] hover:border-[var(--cr-accent)] hover:text-[var(--cr-accent)] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Editar perfil</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs text-[var(--cr-ink-secondary)] tabular-nums">
                <span>{watchlistCount} na lista</span>
                <span aria-hidden="true">·</span>
                <span>{ratingsCount} notas dadas</span>
                <span aria-hidden="true">·</span>
                <span>{authoredCount} {authoredCount === 1 ? 'indicação' : 'indicações'}</span>
              </div>
            </div>

            {editingProfile && (
              <form
                onSubmit={handleSaveProfile}
                className="rounded-xl border border-[var(--cr-border)] bg-[var(--cr-surface-hover)] p-4 space-y-3"
              >
                <div>
                  <label
                    htmlFor="profile-name"
                    className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
                  >
                    Nome exibido na comunidade
                  </label>
                  <input
                    id="profile-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={40}
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-sm text-[var(--cr-ink)] focus:border-[var(--cr-accent)] focus:outline-none"
                  />
                </div>

                <div className="border-t border-[var(--cr-border)] pt-3 space-y-2.5">
                  <p className="text-[11px] font-medium text-[var(--cr-ink-muted)]">
                    Alterar senha (opcional)
                  </p>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Senha atual"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-xs text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                  />
                  <input
                    type="password"
                    minLength={6}
                    maxLength={100}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha (mín. 6 caracteres)"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2 text-xs text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setEditingProfile(false);
                      setProfileName(authUser.name);
                      setCurrentPassword('');
                      setNewPassword('');
                      setErrorMsg('');
                    }}
                    className="min-h-[36px] rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-3 py-1.5 text-xs font-medium text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-alt)] cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[36px] rounded-lg bg-[var(--cr-accent)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--cr-accent-hover)] disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Salvando...' : 'Salvar perfil'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-[var(--cr-border)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-2 text-xs font-semibold text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Continuar navegando
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleLogoutClick}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{submitting ? 'Saindo...' : 'Sair da conta'}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {promptReason && (
              <div className="mt-4 rounded-xl border border-[var(--cr-accent-border)] bg-[var(--cr-accent-soft)] px-4 py-3 text-xs font-medium text-[var(--cr-accent-text)]">
                {promptReason}
              </div>
            )}

            <div
              role="tablist"
              aria-label="Modo de autenticação"
              className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-[var(--cr-surface-alt)] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'login'}
                onClick={() => {
                  setTab('login');
                  setErrorMsg('');
                }}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-[var(--cr-surface)] text-[var(--cr-ink)] shadow-xs'
                    : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                onClick={() => {
                  setTab('register');
                  setErrorMsg('');
                }}
                className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-[var(--cr-surface)] text-[var(--cr-ink)] shadow-xs'
                    : 'text-[var(--cr-ink-secondary)] hover:text-[var(--cr-ink)]'
                }`}
              >
                Criar conta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B] dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                >
                  {errorMsg}
                </div>
              )}

              {tab === 'register' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
                  >
                    Seu nome
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={40}
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Adrian Silva"
                    className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2.5 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
                >
                  E-mail
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={120}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="mt-1.5 w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] px-3 py-2.5 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-[var(--cr-ink-secondary)]"
                >
                  Senha
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    maxLength={100}
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full rounded-lg border border-[var(--cr-border-strong)] bg-[var(--cr-surface)] py-2.5 pl-3 pr-10 text-sm text-[var(--cr-ink)] placeholder:text-[var(--cr-ink-muted)] focus:border-[var(--cr-accent)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--cr-ink-muted)] hover:text-[var(--cr-ink)] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-[var(--cr-border)] pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] rounded-lg border border-[var(--cr-border)] bg-[var(--cr-surface)] px-4 py-2 text-xs font-semibold text-[var(--cr-ink-secondary)] hover:bg-[var(--cr-surface-hover)] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-[var(--cr-accent)] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--cr-accent-hover)] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {tab === 'register' ? (
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>
                    {submitting
                      ? 'Aguarde...'
                      : tab === 'register'
                        ? 'Criar conta'
                        : 'Entrar'}
                  </span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
