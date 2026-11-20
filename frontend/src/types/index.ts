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
