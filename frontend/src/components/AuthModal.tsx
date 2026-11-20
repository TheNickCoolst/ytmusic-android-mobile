import React, { useState } from 'react';
import {
  X,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { UserProfile, api } from '../services/api';
import { googleAuthService } from '../services/googleAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdate,
}) => {
  const [authInput, setAuthInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  // 1-Click Normal Google Account Login
  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const res = await googleAuthService.signIn();
      if (res && res.cookie) {
        setInfoMsg('Google-Authentifizierung erfolgreich! Lade YouTube Music Profil...');
        const loginRes = await api.login(res.cookie);
        onProfileUpdate(loginRes.profile);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      setError(err.message || 'Google-Anmeldung abgebrochen oder fehlgeschlagen.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // Manual fallback via Cookie or Request Headers
  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authInput.trim()) {
      setError('Bitte füge deine YouTube Music Header oder dein Cookie ein.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const res = await api.login(authInput);
      onProfileUpdate(res.profile);
      setAuthInput('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte prüfe die Eingabe.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await googleAuthService.signOut();
      await api.logout();
      onProfileUpdate({ isLoggedIn: false, name: 'Gast' });
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAuthInput(text);
    } catch {
      setError('Konnte nicht aus der Zwischenablage einfügen. Bitte manuell einfügen.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-2xl shadow-2xl p-6 text-white max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-white rounded-full bg-white/5 active:scale-90 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {userProfile.isLoggedIn ? (
          /* Profile Logged In View */
          <div className="flex flex-col items-center text-center py-4">
            <div className="relative">
              <img
                src={
                  userProfile.avatar ||
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                }
                alt={userProfile.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-red-500 shadow-xl"
              />
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#161616] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-bold mt-3 text-white">
              {userProfile.name}
            </h2>
            {userProfile.handle && (
              <p className="text-xs text-zinc-400 mt-0.5">
                {userProfile.handle}
              </p>
            )}

            <div className="mt-4 px-4 py-2.5 rounded-xl bg-white/5 border border-white/5 text-xs text-zinc-300 w-full text-left space-y-1.5">
              <div className="flex items-center text-emerald-400 font-semibold space-x-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Google-Konto aktiv verbunden</span>
              </div>
              <p className="text-zinc-400">
                Deine YouTube Music Playlists, Lieblingslieder und Verlauf sind synchronisiert.
              </p>
            </div>

            <button
              onClick={handleLogout}
              disabled={loading}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-red-600/20 text-zinc-200 hover:text-red-400 border border-white/10 transition flex items-center justify-center space-x-2 font-medium text-sm active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Abmelden</span>
            </button>
          </div>
        ) : (
          /* Login View */
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
                <ShieldCheck className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Mit Google-Konto anmelden
                </h2>
                <p className="text-xs text-zinc-400">
                  Verbinde dein normales YouTube / Google Konto
                </p>
              </div>
            </div>

            {infoMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-start space-x-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{infoMsg}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start space-x-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* NORMAL GOOGLE LOGIN BUTTON */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm active:scale-98 transition flex items-center justify-center space-x-3 shadow-xl cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                    <span>Google-Anmeldung wird geöffnet...</span>
                  </>
                ) : (
                  <>
                    {/* Official Google G Logo */}
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Mit Google anmelden</span>
                  </>
                )}
              </button>

              <div className="flex items-center space-x-2 text-[11px] text-zinc-400 bg-white/5 p-2.5 rounded-xl border border-white/5">
                <Smartphone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Normaler Google-Login: Gib einfach deine normale Google-Mail & Passwort ein. Deine Playlists und Likes werden sofort synchronisiert.
                </span>
              </div>
            </div>

            {/* Manual Cookie/Header Option Toggle */}
            <div className="mt-5 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200 transition"
              >
                <span>Alternative: Manuelle Anmeldung (Cookie / Headers)</span>
                {showManual ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showManual && (
                <form onSubmit={handleManualLogin} className="space-y-3 mt-3 animate-in fade-in duration-150">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-zinc-300">
                        Cookie oder Request-Headers
                      </label>
                      <button
                        type="button"
                        onClick={handlePasteClipboard}
                        className="text-[11px] text-red-400 hover:text-red-300 flex items-center space-x-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Einfügen</span>
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={authInput}
                      onChange={(e) => setAuthInput(e.target.value)}
                      placeholder="SAPISID=...; SSID=... oder Raw Headers"
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500 font-mono resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs active:scale-95 transition flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Prüfen...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Manuell verbinden</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* How-To Accordion */}
            <div className="mt-4 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center justify-between w-full text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                <span className="flex items-center space-x-1.5 font-medium">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Sicherheit & Datenschutz</span>
                </span>
                <span className="text-zinc-500">{showHelp ? '▲' : '▼'}</span>
              </button>

              {showHelp && (
                <div className="mt-2.5 p-3 bg-white/5 rounded-xl text-[11px] text-zinc-400 space-y-1.5 border border-white/5">
                  <p>
                    ✓ <strong>Sicher & Direkt:</strong> Die Anmeldung erfolgt direkt bei Google über den geschützten Google-Anmeldedienst.
                  </p>
                  <p>
                    ✓ <strong>Keine Passwortspeicherung:</strong> Dein Passwort wird niemals gespeichert, sondern nur ein lokaler Sitzungstoken für deine eigene YouTube Music Mediathek.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
