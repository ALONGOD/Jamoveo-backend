import { Song } from '../types';

/**
 * Single-room rehearsal state held in memory (brief: at most one admin / one rehearsal).
 * Persisted nowhere — restarts clear the session, which matches the "Quit" semantics.
 */
class SessionService {
  private currentSong: Song | null = null;

  getCurrentSong(): Song | null {
    return this.currentSong;
  }

  setCurrentSong(song: Song): void {
    this.currentSong = song;
  }

  clear(): void {
    this.currentSong = null;
  }
}

export default new SessionService();
