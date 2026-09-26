import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { mediaPath, parseFilename } from '../src/subtitles';

test('validates configuration, IDs and portable filenames', () => {
  assert.deepEqual(mediaPath('series', 'tt0903747:0:1'), ['tt0903747', '0', '1']);
  for (const id of ['../tt123', 'tt123:1:0', 'tt123:01:2', 'tt123:1:2/..']) {
    assert.equal(mediaPath('series', id), undefined);
  }
  assert.equal(mediaPath('movie', 'tt123:1:2'), undefined);
  assert.equal(parseFilename('../eng.srt'), undefined);
  assert.equal(parseFilename('eng.txt'), undefined);
  assert.equal(parseFilename('en.srt'), undefined);
  assert.deepEqual(parseFilename('srp.latin.bluray.srt'), { lang: 'srp', extension: 'srt' });
  assert.equal(loadConfig({ PUBLIC_URL: 'https://example.com/subhut/' }).publicUrl, 'https://example.com/subhut');
  for (const PORT of ['0', '70000', '1.5', 'abc', '']) assert.throws(() => loadConfig({ PORT }));
  for (const PUBLIC_URL of ['ftp://example.com', 'https://u:p@example.com', 'https://example.com/?x=1']) {
    assert.throws(() => loadConfig({ PUBLIC_URL }));
  }
});

test('SDK HTTP routes discover, serve and refresh subtitles while restricting files', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'subhut-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const movie = path.join(root, 'tt1254207');
  const episode = path.join(root, 'tt0903747', '1', '2');
  await mkdir(movie);
  await mkdir(episode, { recursive: true });
  const sample = '1\n00:00:01,000 --> 00:00:03,000\nHello!\n';
  await writeFile(path.join(movie, 'eng.srt'), sample);
  await writeFile(path.join(movie, 'eng.bluray.srt'), sample);
  await writeFile(path.join(movie, 'secret.txt'), 'private');
  await writeFile(path.join(movie, '.env'), 'private');
  await writeFile(path.join(episode, 'srp.vtt'), 'WEBVTT\n\n00:01.000 --> 00:02.000\nZdravo!\n');
  const server = createApp({ host: '127.0.0.1', port: 7000, publicUrl: 'https://subhut.example/base', subtitlesDir: root }).listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = (route: string) => fetch(`${origin}${route}`);
  const manifest = await (await get('/manifest.json')).json();
  assert.equal(manifest.name, 'SubHut');
  assert.deepEqual(manifest.resources, ['subtitles']);
  const response = await get('/subtitles/movie/tt1254207.json');
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('cache-control')!, /max-age=0/);
  const { subtitles } = await response.json();
  assert.equal(subtitles.length, 2);
  assert.notEqual(subtitles[0].id, subtitles[1].id);
  assert.equal(subtitles[0].lang, 'eng');
  assert.match(subtitles[0].url, /^https:\/\/subhut.example\/base\/files\//);
  const download = await get('/files/movie/tt1254207/eng.srt');
  assert.equal(download.status, 200);
  assert.equal(await download.text(), sample);
  assert.equal(download.headers.get('access-control-allow-origin'), '*');
  assert.match(download.headers.get('content-type')!, /application\/x-subrip/);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  const series = await (await get('/subtitles/series/tt0903747%3A1%3A2/videoHash=abc&videoSize=100.json')).json();
  assert.equal(series.subtitles[0].lang, 'srp');
  assert.equal((await get('/files/series/tt0903747%3A1%3A2/srp.vtt')).status, 200);
  for (const route of ['/subtitles/movie/tt999999.json', '/subtitles/series/tt0903747:1:3.json', '/subtitles/movie/tt1254207:1:2.json']) {
    assert.deepEqual((await (await get(route)).json()).subtitles, []);
  }
  for (const filename of ['secret.txt', '.env', 'fra.srt', '..%2Feng.srt', '%2e%2e%5ceng.srt']) {
    assert.equal((await get(`/files/movie/tt1254207/${filename}`)).status, 404);
  }
  await writeFile(path.join(movie, 'fra.ass'), '[Script Info]\n');
  assert.equal((await (await get('/subtitles/movie/tt1254207.json')).json()).subtitles.length, 3);
  await rm(path.join(movie, 'eng.srt'));
  assert.equal((await get('/files/movie/tt1254207/eng.srt')).status, 404);
  assert.equal((await (await get('/subtitles/movie/tt1254207.json')).json()).subtitles.length, 2);
  assert.equal((await get('/health')).status, 200);
  // Windows junctions do not require the privilege needed to create file symlinks.
  const outside = await mkdtemp(path.join(os.tmpdir(), 'subhut-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, 'eng.srt'), 'outside');
  await symlink(outside, path.join(root, 'tt999'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.deepEqual((await (await get('/subtitles/movie/tt999.json')).json()).subtitles, []);
  assert.equal((await get('/files/movie/tt999/eng.srt')).status, 404);
});
