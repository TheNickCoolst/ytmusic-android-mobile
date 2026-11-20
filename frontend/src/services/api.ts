import { Track, MoodCategory, LyricsResponse } from '../types';

const API_BASE = '/api';

export interface UserProfile {
  isLoggedIn: boolean;
  name: string;
  handle?: string | null;
  avatar?: string | null;
}

export const api = {
  // Auth & Account
  async getAuthStatus(): Promise<UserProfile> {
    try {
      const res = await fetch(`${API_BASE}/auth/status`);
      if (!res.ok) return { isLoggedIn: false, name: 'Gast' };
      return await res.json();
    } catch {
      return { isLoggedIn: false, name: 'Gast' };
    }
  },

  async login(authData: string): Promise<{ status: string; profile: UserProfile }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
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
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  },

  async getUserPlaylists(): Promise<{ id: string; title: string; trackCount?: number; thumbnail: string }[]> {
    const res = await fetch(`${API_BASE}/auth/library/playlists`);
    if (!res.ok) throw new Error('Could not fetch playlists');
    const data = await res.json();
    return data.playlists || [];
  },

  async getUserLikedSongs(): Promise<Track[]> {
    const res = await fetch(`${API_BASE}/auth/library/liked`);
    if (!res.ok) throw new Error('Could not fetch liked songs');
    const data = await res.json();
    return data.tracks || [];
  },

  async getUserHistory(): Promise<Track[]> {
    const res = await fetch(`${API_BASE}/auth/library/history`);
    if (!res.ok) throw new Error('Could not fetch history');
    const data = await res.json();
    return data.history || [];
  },

  async likeTrackOnYouTube(trackId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/track/like`, {
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
      await fetch(`${API_BASE}/auth/track/unlike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: trackId })
      });
    } catch (e) {
      console.warn('Failed to sync unlike with YouTube:', e);
    }
  },

  // Search & Content
  async search(query: string, filter?: string): Promise<Track[]> {
    const params = new URLSearchParams({ q: query });
    if (filter && filter !== 'all') {
      params.append('filter', filter);
    }
    const res = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.results || [];
  },

  async getCharts(country = 'DE'): Promise<Track[]> {
    const res = await fetch(`${API_BASE}/charts?country=${country}`);
    if (!res.ok) throw new Error('Charts failed');
    const data = await res.json();
    return data.items || [];
  },

  async getExplore(): Promise<MoodCategory[]> {
    const res = await fetch(`${API_BASE}/explore`);
    if (!res.ok) throw new Error('Explore failed');
    const data = await res.json();
    return data.moods || [];
  },

  async getRadio(videoId: string): Promise<Track[]> {
    const res = await fetch(`${API_BASE}/radio/${videoId}`);
    if (!res.ok) throw new Error('Radio failed');
    const data = await res.json();
    return data.tracks || [];
  },

  async getLyrics(videoId: string): Promise<LyricsResponse> {
    const res = await fetch(`${API_BASE}/lyrics/${videoId}`);
    if (!res.ok) return { lyrics: null, source: null };
    return await res.json();
  },

  getStreamUrl(videoId: string): string {
    return `${API_BASE}/stream/${videoId}`;
  },

  async getCacheList() {
    const res = await fetch(`${API_BASE}/cache`);
    if (!res.ok) throw new Error('Cache check failed');
    return await res.json();
  },

  async deleteFromCache(videoId: string) {
    const res = await fetch(`${API_BASE}/cache/${videoId}`, { method: 'DELETE' });
    return await res.json();
  },

  async downloadTrack(videoId: string) {
    const res = await fetch(`${API_BASE}/download/${videoId}`, { method: 'POST' });
    return await res.json();
  }
};
