import { addonBuilder, type Manifest } from 'stremio-addon-sdk';
import type { SubtitleRepository } from './subtitles';

export const manifest: Manifest = {
  id: 'org.subhut.subtitles',
  version: '0.1.0',
  name: 'SubHut',
  description: 'Your own subtitles, served from your own library.',
  resources: ['subtitles'],
  types: ['movie', 'series'],
  idPrefixes: ['tt'],
  catalogs: [],
};

export function createAddon(repository: SubtitleRepository) {
  const builder = new addonBuilder(manifest);
  builder.defineSubtitlesHandler(async ({ type, id }) => ({
    subtitles: await repository.list(type, id),
    cacheMaxAge: 0,
  }));
  return builder.getInterface();
}
