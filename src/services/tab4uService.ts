import axios from 'axios';
import * as cheerio from 'cheerio';
import { Song, SongLine, SongSearchResult, SongToken } from '../types';

const TAB4U_BASE = 'https://www.tab4u.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const httpClient = axios.create({
  baseURL: TAB4U_BASE,
  timeout: 15000,
  headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he,en;q=0.9' },
});

/**
 * Search Tab4U for songs matching a query (Hebrew or English).
 * Scrapes the simple results page and extracts song link cards.
 */
export const searchSongs = async (query: string): Promise<SongSearchResult[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data } = await httpClient.get<string>('/resultsSimple', {
    params: { tab: 'songs', q: trimmed },
    responseType: 'text',
  });

  const $ = cheerio.load(data);
  const results: SongSearchResult[] = [];

  $('a.ruSongLink').each((_, anchor) => {
    const $a = $(anchor);
    const href = $a.attr('href');
    if (!href) return;

    const sourceUrl = href.startsWith('http') ? href : `${TAB4U_BASE}/${href.replace(/^\/+/, '')}`;

    // URL form: tabs/songs/<id>_<artist>_-_<title>.html
    const idMatch = sourceUrl.match(/\/tabs\/songs\/(\d+)_/);
    const id = idMatch?.[1] ?? sourceUrl;

    // Title cell renders as "Title /" – trim the trailing slash
    const title = $a
      .find('.sNameI19')
      .first()
      .text()
      .replace(/\/\s*$/, '')
      .trim();
    const artist = $a.find('.aNameI19').first().text().trim();

    // Inline style: background-image:url(/additions/artists_imgs/...)
    const photoStyle = $a.find('.ruArtPhoto').first().attr('style') ?? '';
    const imgMatch = photoStyle.match(/url\(([^)]+)\)/);
    const image = imgMatch
      ? imgMatch[1].startsWith('http')
        ? imgMatch[1]
        : `${TAB4U_BASE}${imgMatch[1].startsWith('/') ? '' : '/'}${imgMatch[1]}`
      : undefined;

    if (title && artist) {
      results.push({ id, title, artist, image, sourceUrl });
    }
  });

  return results;
};

/**
 * Pair a chord row and a lyric row (both space-aligned strings) into Token columns.
 * Each chord is anchored to its column, and the lyric segment under it becomes the token's text.
 */
const pairToTokens = (chordLine: string, lyricLine: string): SongToken[] => {
  const cleanChord = chordLine.replace(/\u00A0/g, ' ').replace(/\s+$/g, '');
  const cleanLyric = lyricLine.replace(/\u00A0/g, ' ').replace(/\s+$/g, '');

  if (!cleanChord && !cleanLyric) return [{ lyric: ' ' }];
  if (!cleanChord) return [{ lyric: cleanLyric || ' ' }];

  // Pad lyric so column slicing never falls off the end
  const maxLen = Math.max(cleanChord.length, cleanLyric.length);
  const lyricPadded = cleanLyric.padEnd(maxLen, ' ');

  const positions: { col: number; chord: string }[] = [];
  const chordRegex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = chordRegex.exec(cleanChord)) !== null) {
    positions.push({ col: match.index, chord: match[0] });
  }

  if (positions.length === 0) return [{ lyric: cleanLyric || ' ' }];

  const tokens: SongToken[] = [];

  // Lyric chunk before the first chord (if any)
  if (positions[0].col > 0) {
    tokens.push({ lyric: lyricPadded.slice(0, positions[0].col) });
  }

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].col;
    const end = i + 1 < positions.length ? positions[i + 1].col : maxLen;
    const slice = lyricPadded.slice(start, end);
    tokens.push({ chord: positions[i].chord, lyric: slice.length === 0 ? ' ' : slice });
  }

  return tokens;
};

/**
 * Fetch a Tab4U song page and extract title, artist, and lines of {chord?, lyric} tokens.
 * Tab4U renders songs as alternating <td class="chords*"> then <td class="song"> rows.
 * We walk those rows in document order, pairing chord rows with the following lyric row.
 */
export const fetchSong = async (url: string): Promise<Song> => {
  if (!url.startsWith(TAB4U_BASE)) {
    throw new Error('INVALID_SOURCE_URL');
  }

  const { data } = await httpClient.get<string>(url.replace(TAB4U_BASE, ''), {
    responseType: 'text',
  });

  const $ = cheerio.load(data);

  // Title/artist sit in the H1 like "אקורדים לשיר Hallelujah של Jeff Buckley".
  // Using URL fallback because the H1 mixes Hebrew prefixes — URL is more robust.
  let title = '';
  let artist = '';

  const urlPart = decodeURIComponent(url.split('/').pop() ?? '');
  const urlMatch = urlPart.match(/^\d+_(.+?)_-_(.+?)\.html$/);
  if (urlMatch) {
    artist = urlMatch[1].replace(/_/g, ' ').trim();
    title = urlMatch[2].replace(/_/g, ' ').trim();
  }

  // Fallback: try the page title <title>
  if (!title || !artist) {
    const pageTitle = $('title').first().text();
    const m = pageTitle.match(/(?:אקורדים לשיר\s+)?(.+?)\s*[-/]\s*(.+?)(?:\s*\|\s*Tab4U)?$/);
    if (m) {
      title = title || m[1].trim();
      artist = artist || m[2].trim();
    }
  }

  const lines: SongLine[] = [];

  // Iterate every <tr> within the song content container, in document order.
  // We track the previous row's role to pair chords -> next song row.
  const rows = $('#songContentTPL tr').toArray();
  let pendingChord: string | null = null;

  for (const tr of rows) {
    const $tr = $(tr);
    const td = $tr.find('td').first();
    if (!td.length) continue;

    const cls = td.attr('class') ?? '';
    const isChord = /(^|\s)chords(_en|_he)?(\s|$)/.test(cls);
    const isLyric = /(^|\s)song(\s|$)/.test(cls);
    // cheerio decodes &nbsp; into U+00A0 (positional padding) — preserve those.
    // Strip HTML-indentation tabs/newlines and trim ASCII spaces only at the edges.
    const text = td
      .text()
      .replace(/[\r\n\t]/g, '')
      .replace(/^[ ]+|[ ]+$/g, '');

    if (isChord) {
      // If we already had a pending chord with no lyric in between, flush it as a chord-only line.
      if (pendingChord !== null) {
        lines.push({ tokens: pairToTokens(pendingChord, '') });
      }
      pendingChord = text;
    } else if (isLyric) {
      lines.push({ tokens: pairToTokens(pendingChord ?? '', text) });
      pendingChord = null;
    }
  }

  // Trailing chord row with no lyric below
  if (pendingChord !== null) {
    lines.push({ tokens: pairToTokens(pendingChord, '') });
  }

  return {
    title: title || 'Unknown',
    artist: artist || 'Unknown',
    sourceUrl: url,
    lines,
  };
};

export default { searchSongs, fetchSong };
