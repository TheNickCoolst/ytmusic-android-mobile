export interface Track {
  id: string;
  title: string;
  artist: string;
  artists?: string[];
  album?: string;
  duration?: string;
  durationSeconds?: number;
  thumbnail: string;
  type?: string;
  isCached?: boolean;
  rank?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  tracks: Track[];
  createdAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type EqualizerPreset = 'flat' | 'bass_boost' | 'vocal' | 'dance' | 'rock' | 'clarity';

export interface MoodCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  query: string;
}

export interface LyricsResponse {
  lyrics: string | null;
  source: string | null;
}

export interface HomeShelf {
  id: string;
  title: string;
  subtitle?: string;
  type: 'columns_4' | 'rankings' | 'playlists' | 'horizontal_cards';
  columns?: Track[][];
  items?: any[];
  tracks?: Track[];
}
