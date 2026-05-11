import { Response } from 'express';
import tab4uService from '../services/tab4uService';
import { AuthRequest } from '../types';

export const searchSongs = async (req: AuthRequest, res: Response): Promise<void> => {
  const q = (req.query.q ?? '').toString().trim();
  if (!q) {
    res.status(400).json({ success: false, message: 'Query param q is required' });
    return;
  }

  try {
    const results = await tab4uService.searchSongs(q);
    res.json({ success: true, results });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: 'Failed to search Tab4U',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const fetchSong = async (req: AuthRequest, res: Response): Promise<void> => {
  const url = (req.query.url ?? '').toString().trim();
  if (!url) {
    res.status(400).json({ success: false, message: 'Query param url is required' });
    return;
  }

  try {
    const song = await tab4uService.fetchSong(url);
    res.json({ success: true, song });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg === 'INVALID_SOURCE_URL') {
      res.status(400).json({ success: false, message: 'Only Tab4U URLs are allowed' });
      return;
    }
    res.status(502).json({ success: false, message: 'Failed to fetch song', error: msg });
  }
};
