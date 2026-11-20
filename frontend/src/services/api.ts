import { Track, MoodCategory, LyricsResponse } from '../types';

export interface UserProfile {
  isLoggedIn: boolean;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

// Dynamic API Base Resolution
export const getApiBase = (): string => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000/api';

  // 1. User manual override in localStorage
  let saved: string | null = null;
  try { saved = localStorage.getItem('ytmusic_server_url'); } catch { /* ignore */ }
  if (saved) return `${saved.replace(/\/+$/, '')}/api`;

  // 2. If running in browser or PWA where port is 8000
  if (window.location.port === '8000') {
    return `${window.location.origin}/api`;
  }

  // 3. If running on another port or domain (e.g. 192.168.178.183:5173 or dev)
  if (window.location.hostname && window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.')) {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }

  // 4. Fallback for native Android APK: the Mac's LAN IP
  return 'http://192.168.178.183:8000/api';
};

export const api = {
  // Auth & Account
  async getAuthStatus(): Promise<UserProfile> {
    try {
      const res = await fetch(`${getApiBase()}/auth/status`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { isLoggedIn: false, name: 'Gast' };
      return await res.json();
    } catch {
      return { isLoggedIn: false, name: 'Gast' };
    }
  },

  async login(authData: string): Promise<{ status: string; profile: UserProfile }> {
    const res = await fetch(`${getApiBase()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth: authData })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Anmeldung fehlgeschlagen' }));
      throw new Error(err.detail || 'Anmeldung fehlgeschlagen');
    }
    return await res.json();
  },

  async logout(): Promise<void> {
    await fetch(`${getApiBase()}/auth/logout`, { method: 'POST' });
  },

  async getUserPlaylists(): Promise<{ id: string; title: string; trackCount?: number; thumbnail: string }[]> {
    const res = await fetch(`${getApiBase()}/auth/library/playlists`);
    if (!res.ok) throw new Error('Could not fetch playlists');
    const data = await res.json();
    return data.playlists || [];
  },

  async getUserLikedSongs(): Promise<Track[]> {
    const res = await fetch(`${getApiBase()}/auth/library/liked`);
    if (!res.ok) throw new Error('Could not fetch liked songs');
    const data = await res.json();
    return data.tracks || [];
  },

  async getUserHistory(): Promise<Track[]> {
    const res = await fetch(`${getApiBase()}/auth/library/history`);
    if (!res.ok) throw new Error('Could not fetch history');
    const data = await res.json();
    return data.history || [];
  },

  async likeTrackOnYouTube(trackId: string): Promise<void> {
    try {
      await fetch(`${getApiBase()}/auth/track/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId })
      });
    } catch (e) {
      console.warn('Failed to sync like with YouTube:', e);
    }
  },

  async unlikeTrackOnYouTube(trackId: string): Promise<void> {
    try {
      await fetch(`${getApiBase()}/auth/track/unlike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId })
      });
    } catch (e) {
      console.warn('Failed to sync unlike with YouTube:', e);
    }
  },

  // Content & Feed
  async getHomeFeed(country = 'DE'): Promise<{ shelves: any[] }> {
    try {
      const res = await fetch(`${getApiBase()}/home?country=${country}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('Home feed failed');
      return await res.json();
    } catch (e) {
      console.warn('Backend home feed unreachable, using offline fallback shelves');
      return {
        shelves: [
          {
            id: 'quick_picks',
            title: 'Schnellauswahl',
            subtitle: 'STARTET EINE RADIOSTATION',
            type: 'columns_4',
            columns: [
              [
                { id: 'J7p4bzqLvCw', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/J7p4bzqLvCw/hqdefault.jpg', duration: '3:22' },
                { id: '4EQkYVtE-28', title: 'Circles', artist: 'Post Malone', thumbnail: 'https://i.ytimg.com/vi/4EQkYVtE-28/hqdefault.jpg', duration: '3:35' },
                { id: 'nujn6wbr-e8', title: 'As It Was', artist: 'Harry Styles', thumbnail: 'https://i.ytimg.com/vi/nujn6wbr-e8/hqdefault.jpg', duration: '2:47' },
                { id: 'XfEMj-z3TtA', title: 'STAY', artist: 'The Kid LAROI, Justin Bieber', thumbnail: 'https://i.ytimg.com/vi/XfEMj-z3TtA/hqdefault.jpg', duration: '2:21' },
              ],
              [
                { id: 'k2qgadSvNyU', title: 'New Rules', artist: 'Dua Lipa', thumbnail: 'https://i.ytimg.com/vi/k2qgadSvNyU/hqdefault.jpg', duration: '3:44' },
                { id: 'OPf0YbXqDm0', title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', thumbnail: 'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg', duration: '4:30' },
                { id: '2Vv-BfVoq4g', title: 'Perfect', artist: 'Ed Sheeran', thumbnail: 'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg', duration: '4:23' },
                { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration: '3:34' },
              ]
            ],
            tracks: [
              { id: 'J7p4bzqLvCw', title: 'Blinding Lights', artist: 'The Weeknd', thumbnail: 'https://i.ytimg.com/vi/J7p4bzqLvCw/hqdefault.jpg', duration: '3:22' },
              { id: '4EQkYVtE-28', title: 'Circles', artist: 'Post Malone', thumbnail: 'https://i.ytimg.com/vi/4EQkYVtE-28/hqdefault.jpg', duration: '3:35' },
              { id: 'nujn6wbr-e8', title: 'As It Was', artist: 'Harry Styles', thumbnail: 'https://i.ytimg.com/vi/nujn6wbr-e8/hqdefault.jpg', duration: '2:47' },
              { id: 'XfEMj-z3TtA', title: 'STAY', artist: 'The Kid LAROI, Justin Bieber', thumbnail: 'https://i.ytimg.com/vi/XfEMj-z3TtA/hqdefault.jpg', duration: '2:21' },
            ]
          }
        ]
      };
    }
  },

  async getPlaylist(playlistId: string): Promise<any> {
    const res = await fetch(`${getApiBase()}/playlist/${playlistId}`);
    if (!res.ok) throw new Error('Playlist failed');
    return await res.json();
  },

  async search(query: string, filter?: string): Promise<Track[]> {
    const params = new URLSearchParams({ q: query });
    if (filter && filter !== 'all') {
      params.append('filter', filter);
    }
    const res = await fetch(`${getApiBase()}/search?${params.toString()}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.results || [];
  },

  async getCharts(country = 'DE'): Promise<Track[]> {
    const res = await fetch(`${getApiBase()}/charts?country=${country}`);
    if (!res.ok) throw new Error('Charts failed');
    const data = await res.json();
    return data.items || [];
  },

  async getExplore(): Promise<MoodCategory[]> {
    const res = await fetch(`${getApiBase()}/explore`);
    if (!res.ok) throw new Error('Explore failed');
    const data = await res.json();
    return data.moods || [];
  },

  async getRadio(videoId: string): Promise<Track[]> {
    const res = await fetch(`${getApiBase()}/radio/${videoId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.tracks || [];
  },

  async getLyrics(videoId: string, title?: string, artist?: string): Promise<LyricsResponse> {
    try {
      const params = new URLSearchParams();
      if (title) params.append('title', title);
      if (artist) params.append('artist', artist);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${getApiBase()}/lyrics/${videoId}${q}`);
      if (!res.ok) return { lyrics: null, isSynced: false, source: null };
      return await res.json();
    } catch {
      return { lyrics: null, isSynced: false, source: null };
    }
  },

  getStreamUrl(videoId: string): string {
    return `${getApiBase()}/stream/${videoId}`;
  },

  async getCacheList() {
    try {
      const res = await fetch(`${getApiBase()}/cache`);
      if (!res.ok) return { totalSizeMB: '0 MB', count: 0, tracks: [] };
      return await res.json();
    } catch {
      return { totalSizeMB: '0 MB', count: 0, tracks: [] };
    }
  },

  async deleteFromCache(videoId: string) {
    const res = await fetch(`${getApiBase()}/cache/${videoId}`, { method: 'DELETE' });
    return await res.json();
  },

  async downloadTrack(videoId: string, meta?: { title?: string; artist?: string; thumbnail?: string; duration?: string }) {
    const res = await fetch(`${getApiBase()}/download/${videoId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta || {})
    });
    return await res.json();
  }
};
