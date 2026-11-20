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
  ExternalLink,
  Smartphone,
  ListMusic,
  Check
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
  const [playlistUrlInput, setPlaylistUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [browserOpened, setBrowserOpened] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showPlaylistImport, setShowPlaylistImport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  // Opens the user's normal mobile browser directly (as requested)
  const handleOpenNormalBrowser = async () => {
    setGoogleLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      await googleAuthService.openSystemBrowser();
      setBrowserOpened(true);
      setInfoMsg(
        'Normaler Handy-Browser (z.B. Chrome) wurde geöffnet! Melde dich dort an und füge die Anmeldung anschließend unten ein.'
      );
    } catch (err: any) {
      console.warn('Error opening mobile browser:', err);
      setError(err.message || 'Mobiler Browser konnte nicht geöffnet werden.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // 1-Click Paste & Login from Clipboard
  const handlePasteAndLogin = async () => {
    setLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      let text = '';
      try {
        text = await navigator.clipboard.readText();
      } catch {
        setError('Zwischenablage konnte nicht automatisch gelesen werden. Bitte manuell einfügen.');
        setLoading(false);
        setShowManual(true);
        return;
      }

      if (!text || !text.trim()) {
        setError('Die Zwischenablage ist leer. Kopiere zuerst deine Anmeldung aus dem Browser.');
        setLoading(false);
        return;
      }

      setAuthInput(text);
      const res = await api.login(text);
      onProfileUpdate(res.profile);
      setInfoMsg('Erfolgreich mit deinem Google-Konto verbunden!');
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte prüfe die Daten.');
      setShowManual(true);
    } finally {
      setLoading(false);
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

  // Import Playlist without login
  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = playlistUrlInput.trim();
    if (!raw) return;

    let playlistId = raw;
    const listMatch = raw.match(/[?&]list=([^#&]+)/);
    if (listMatch) playlistId = listMatch[1];

    setPlaylistLoading(true);
    setError(null);
    setInfoMsg(null);

    try {
      const pl = await api.getPlaylist(playlistId);
      if (pl && pl.tracks && pl.tracks.length > 0) {
        // Save to local playlists
        const saved = localStorage.getItem('ytmusic_playlists');
        const list = saved ? JSON.parse(saved) : [];
        list.unshift({
          id: pl.id,
          title: pl.title,
          description: pl.description || 'Importierte YouTube Playlist',
          thumbnail: pl.thumbnail,
          tracks: pl.tracks,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('ytmusic_playlists', JSON.stringify(list));
        setInfoMsg(`Playlist "${pl.title}" (${pl.tracks.length} Lieder) erfolgreich importiert!`);
        setPlaylistUrlInput('');
      } else {
        setError('Keine Lieder in dieser Playlist gefunden.');
      }
    } catch (err: any) {
      setError(err.message || 'Playlist konnte nicht geladen werden. Ist der Link öffentlich?');
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handleCopySnippet = () => {
    const code = "javascript:navigator.clipboard.writeText(document.cookie);alert('Anmeldung kopiert! Gehe zurück zur App');";
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 3000);
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
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-red-600/20 text-zinc-200 hover:text-red-400 border border-white/10 transition flex items-center justify-center space-x-2 font-medium text-sm active:scale-95 cursor-pointer"
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
                <Smartphone className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Mit Google anmelden
                </h2>
                <p className="text-xs text-zinc-400">
                  Über deinen normalen Handy-Browser (z.B. Chrome)
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

            {/* STEP 1: OPEN NORMAL MOBILE BROWSER BUTTON */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleOpenNormalBrowser}
                disabled={googleLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 font-semibold text-sm active:scale-98 transition flex items-center justify-center space-x-3 shadow-xl cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-900" />
                    <span>Browser wird geöffnet...</span>
                  </>
                ) : (
                  <>
                    {/* Google Icon */}
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
                    <span>Im normalen Handy-Browser öffnen</span>
                    <ExternalLink className="w-4 h-4 text-zinc-500 ml-1" />
                  </>
                )}
              </button>

              {/* STEP 2: PASTE & CONNECT FROM CLIPBOARD */}
              <button
                type="button"
                onClick={handlePasteAndLogin}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-semibold text-xs active:scale-98 transition flex items-center justify-center space-x-2 shadow-lg shadow-red-600/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verbindung wird geprüft...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Aus Zwischenablage einfügen & Verbinden</span>
                  </>
                )}
              </button>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-[11px] text-zinc-400 space-y-2">
                <p>
                  <strong>So funktioniert es:</strong>
                  <br />
                  1. Tippe oben auf <strong>„Im normalen Handy-Browser öffnen“</strong>.
                  <br />
                  2. Melde dich bei YouTube Music an.
                  <br />
                  3. Kopiere den Code oder das Cookie und tippe auf <strong>„Aus Zwischenablage einfügen“</strong>.
                </p>

                <button
                  type="button"
                  onClick={handleCopySnippet}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/10 text-[10px] text-zinc-300 flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate mr-2 font-mono text-zinc-400">
                    Kopier-Hilfe für den Browser (1 Klick)
                  </span>
                  {codeCopied ? (
                    <span className="text-emerald-400 flex items-center space-x-1 flex-shrink-0">
                      <Check className="w-3 h-3" />
                      <span>Kopiert!</span>
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center space-x-1 flex-shrink-0">
                      <Copy className="w-3 h-3" />
                      <span>Code kopieren</span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* OPTION B: PLAYLIST IMPORT BY URL / LINK (NO LOGIN REQUIRED) */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowPlaylistImport(!showPlaylistImport)}
                className="flex items-center justify-between w-full text-xs text-zinc-300 hover:text-white transition font-medium"
              >
                <span className="flex items-center space-x-2">
                  <ListMusic className="w-4 h-4 text-red-500" />
                  <span>Oder: Eigene Playlist per YouTube-Link importieren</span>
                </span>
                {showPlaylistImport ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showPlaylistImport && (
                <form
                  onSubmit={handleImportPlaylist}
                  className="space-y-2.5 mt-3 animate-in fade-in duration-150"
                >
                  <p className="text-[11px] text-zinc-400">
                    Füge einfach den Link einer öffentlichen oder nicht-gelisteten YouTube-Playlist ein – kein Passwort oder Cookie nötig!
                  </p>
                  <input
                    type="text"
                    value={playlistUrlInput}
                    onChange={(e) => setPlaylistUrlInput(e.target.value)}
                    placeholder="https://music.youtube.com/playlist?list=..."
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={playlistLoading}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {playlistLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ListMusic className="w-3.5 h-3.5" />
                    )}
                    <span>Playlist in Mediathek laden</span>
                  </button>
                </form>
              )}
            </div>

            {/* OPTION C: MANUAL COOKIE / HEADERS */}
            <div className="mt-3 pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="flex items-center justify-between w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition"
              >
                <span>Manuelle Eingabe (Cookie / Raw Headers)</span>
                {showManual ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showManual && (
                <form
                  onSubmit={handleManualLogin}
                  className="space-y-3 mt-3 animate-in fade-in duration-150"
                >
                  <textarea
                    rows={3}
                    value={authInput}
                    onChange={(e) => setAuthInput(e.target.value)}
                    placeholder="SAPISID=...; SSID=... oder Raw Headers"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-red-500 font-mono resize-none"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs active:scale-95 transition flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogIn className="w-3.5 h-3.5" />
                    )}
                    <span>Manuell verbinden</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
