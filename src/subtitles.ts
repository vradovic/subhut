import { createHash } from 'node:crypto';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { Subtitle } from 'stremio-addon-sdk';

export const subtitleTypes: Readonly<Record<string, string>> = {
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  ass: 'text/x-ssa',
  ssa: 'text/x-ssa',
};

/** Translate Stremio IDs to portable paths; never accept user-supplied path segments. */
export function mediaPath(type: string, id: string): string[] | undefined {
  if (type === 'movie' && /^tt\d+$/.test(id)) return [id];
  const episode = /^(tt\d+):(0|[1-9]\d*):([1-9]\d*)$/.exec(id);
  if (type === 'series' && episode) return [episode[1]!, episode[2]!, episode[3]!];
  return undefined;
}

export function parseFilename(filename: string): { lang: string; extension: string } | undefined {
  const match = /^([a-z]{3})(?:\.[a-zA-Z0-9_-]+)*\.(srt|vtt|ass|ssa)$/.exec(filename);
  return match ? { lang: match[1]!, extension: match[2]! } : undefined;
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code));
}

export class SubtitleRepository {
  constructor(private readonly root: string, private readonly publicUrl: string) {}

  /** Check every component so symbolic links cannot expose files outside the library. */
  private async resolve(parts: string[]): Promise<string | undefined> {
    try {
      let current = await realpath(this.root);
      for (const part of parts) {
        current = path.join(current, part);
        if ((await lstat(current)).isSymbolicLink()) return undefined;
      }
      return current;
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async list(type: string, id: string): Promise<Subtitle[]> {
    const parts = mediaPath(type, id);
    if (!parts) return [];
    const directory = await this.resolve(parts);
    if (!directory) return [];
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      return entries.sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
        const metadata = parseFilename(entry.name);
        if (!entry.isFile() || !metadata) return [];
        return [{
          id: createHash('sha256').update(`${type}/${id}/${entry.name}`).digest('hex'),
          lang: metadata.lang,
          url: `${this.publicUrl}/files/${type}/${encodeURIComponent(id)}/${encodeURIComponent(entry.name)}`,
        }];
      });
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  }

  async findFile(type: string, id: string, filename: string): Promise<string | undefined> {
    const parts = mediaPath(type, id);
    if (!parts || !parseFilename(filename)) return undefined;
    const file = await this.resolve([...parts, filename]);
    if (!file) return undefined;
    try {
      return (await lstat(file)).isFile() ? file : undefined;
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }
}
