import React, { useState } from 'react';
import { X, LogIn, LogOut, CheckCircle2, AlertCircle, HelpCircle, KeyRound, Sparkles, Loader2, Copy } from 'lucide-react';
import { UserProfile, api } from '../services/api';

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
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authInput.trim()) {
      setError('Bitte füge deine YouTube Music Header oder dein Cookie ein.');
      return;
    }

    setLoading(true);
    setError(null);

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
                src={userProfile.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
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
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Mit YouTube Account anmelden
                </h2>
                <p className="text-xs text-zinc-400">
                  Synchronisiere deine eigenen Playlists & Lieblingslieder
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start space-x-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
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
                  rows={4}
                  value={authInput}
                  onChange={(e) => setAuthInput(e.target.value)}
                  placeholder="Füge hier deinen Cookie-String (z.B. SID=...; SAPISID=...) oder die Request-Headers aus music.youtube.com ein..."
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500 font-mono resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-semibold text-sm shadow-lg shadow-red-600/20 active:scale-95 transition flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verbindung wird geprüft...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Mit Google-Konto verbinden</span>
                  </>
                )}
              </button>
            </form>

            {/* Server Connection Info for Android APK */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <div className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center justify-between">
                <span>Server-Adresse (Android APK):</span>
                <span className="text-emerald-400 text-[10px]">192.168.178.183:8000</span>
              </div>
              <p className="text-[10px] text-zinc-500">
                Die APK verbindet sich automatisch mit deinem Computer im selben WLAN.
              </p>
            </div>

            {/* How-To Accordion */}
            <div className="mt-5 border-t border-white/5 pt-4">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center justify-between w-full text-xs text-zinc-400 hover:text-zinc-200"
              >
                <span className="flex items-center space-x-1.5 font-medium">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Wie erhalte ich mein Cookie / meine Header?</span>
                </span>
                <span className="text-zinc-500">{showHelp ? '▲' : '▼'}</span>
              </button>

              {showHelp && (
                <div className="mt-3 p-3 bg-white/5 rounded-xl text-[11px] text-zinc-300 space-y-2 border border-white/5">
                  <p>
                    <strong className="text-white">Option 1 (PC / Mac Browser):</strong>
                    <br />
                    1. Öffne <span className="text-red-400">music.youtube.com</span> und melde dich an.
                    <br />
                    2. Drücke <kbd className="bg-black/50 px-1 rounded">F12</kbd> (Entwicklertools) → Tab <em>Netzwerk</em>.
                    <br />
                    3. Klicke auf eine Anfrage (z.B. <code className="text-zinc-400">browse</code>).
                    <br />
                    4. Kopiere unter <em>Request Headers</em> den Wert von <code className="text-zinc-400">cookie</code> oder alle Header und füge ihn oben ein.
                  </p>
                  <p>
                    <strong className="text-white">Option 2 (Android Handy):</strong>
                    <br />
                    Öffne YouTube Music im Browser (z.B. Chrome/Brave/Kiwi mit Cookie-Erweiterung) und kopiere das Anmelde-Cookie.
                  </p>
                  <p className="text-[10px] text-emerald-400">
                    ✓ Deine Zugangsdaten verbleiben sicher nur auf deinem eigenen Gerät!
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
