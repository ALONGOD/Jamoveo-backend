import { Request } from 'express';

export type Instrument =
  | 'drums'
  | 'guitar'
  | 'bass'
  | 'saxophone'
  | 'keyboards'
  | 'vocals';

export type Role = 'user' | 'admin';

export interface JwtPayload {
  userId: string;
  username: string;
  role: Role;
  instrument: Instrument;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// Song shape exposed to clients (also rendered on FE Live page)
export interface SongToken {
  chord?: string;
  lyric: string;
}

export interface SongLine {
  tokens: SongToken[];
}

export interface SongSearchResult {
  id: string;
  title: string;
  artist: string;
  image?: string;
  sourceUrl: string;
}

export interface Song {
  title: string;
  artist: string;
  sourceUrl: string;
  image?: string;
  lines: SongLine[];
}
