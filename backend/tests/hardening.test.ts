import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.ts';
import {
  isEmailAllowed,
  loadInstitutionConfig,
  validateInstitutionConfig,
} from '../src/config/institution.ts';
import { SEED_STUDENT_PASSWORD } from '../src/config/constants.ts';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runInChild(script: string, env: Record<string, string>) {
  const cleanEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !/^(AUTH_SECRET|SEED_|NODE_ENV|INSTITUTION_|EMAIL_POLICY|ALLOWED_EMAIL|MOCK_ADMIN)/.test(k)) {
      cleanEnv[k] = v;
    }
  }
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: BACKEND_DIR,
    env: { ...cleanEnv, ...env },
    encoding: 'utf8',
  });
}

describe('Institution profile (white-label configuration)', () => {
  test('default preset keeps the original engineering behaviour', () => {
    const cfg = loadInstitutionConfig({});
    assert.equal(cfg.emailPolicy, 'edu');
    assert.equal(cfg.years.length, 4);
    assert.ok(cfg.programs.some((p) => p.code === 'CSE'));
    assert.equal(isEmailAllowed('aarav@btech.college.edu.in', cfg), true);
    assert.equal(isEmailAllowed('someone@gmail.com', cfg), false);
  });

  test('university preset offers broader programs and years', () => {
    const cfg = loadInstitutionConfig({ INSTITUTION_PRESET: 'university' });
    assert.ok(cfg.programs.some((p) => p.name === 'Law'));
    assert.ok(cfg.years.includes('Postgraduate'));
  });

  test('open policy accepts any valid email, domains policy only the allowlist', () => {
    const open = loadInstitutionConfig({ EMAIL_POLICY: 'open' });
    assert.equal(isEmailAllowed('person@gmail.com', open), true);
    assert.equal(isEmailAllowed('not-an-email', open), false);
    assert.equal(isEmailAllowed('9876543210', open), false);

    const domains = loadInstitutionConfig({ ALLOWED_EMAIL_DOMAINS: 'school.org, uni.ac.uk' });
    assert.equal(domains.emailPolicy, 'domains');
    assert.equal(isEmailAllowed('a@school.org', domains), true);
    assert.equal(isEmailAllowed('a@mail.uni.ac.uk', domains), true);
    assert.equal(isEmailAllowed('a@evil-school.org', domains), false);
    assert.equal(isEmailAllowed('a@gmail.com', domains), false);
  });

  test('invalid configuration fails loudly instead of silently misbehaving', () => {
    assert.throws(() => loadInstitutionConfig({ INSTITUTION_PRESET: 'nope' }), /unknown INSTITUTION_PRESET/);
    assert.throws(() => validateInstitutionConfig({ programs: [] }), /programs/);
    assert.throws(() => validateInstitutionConfig({ years: ['1st', '1st'] }), /duplicate/);
    assert.throws(() => validateInstitutionConfig({ emailPolicy: 'domains', allowedEmailDomains: [] }), /allowedEmailDomains/);
  });
});

describe('Edit and delete authorization, public config endpoint', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let ownerToken = '';
  let otherToken = '';

  async function login(identifier: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier, password: SEED_STUDENT_PASSWORD },
    });
    assert.equal(res.statusCode, 200);
    return res.json().session.token as string;
  }

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-hardening-'));
    app = (await buildApp({ dbPath: path.join(tmpDir, 'h.db'), logger: false })).app;
    ownerToken = await login('quantum_dev');
    otherToken = await login('cyber_sage');
  });

  after(async () => {
    if (app) await app.close();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('GET /config is public and exposes only safe fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/config' });
    assert.equal(res.statusCode, 200);
    const cfg = res.json();
    assert.ok(Array.isArray(cfg.programs) && cfg.programs.length > 0);
    assert.ok(Array.isArray(cfg.years));
    assert.equal(typeof cfg.appName, 'string');
    assert.equal('allowedEmailDomains' in cfg, false);
  });

  test('responses carry baseline security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['referrer-policy'], 'no-referrer');
  });

  test('author can edit a post; others cannot; empty edits are rejected; edited flag is set', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { space: 'public', type: 'Tip', title: 'Original', content: 'First draft #draft' },
    });
    assert.equal(created.statusCode, 201);
    const id = created.json().id as string;
    assert.equal(created.json().edited, false);

    const byOther = await app.inject({
      method: 'PATCH',
      url: `/api/v1/posts/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { content: 'hijacked' },
    });
    assert.equal(byOther.statusCode, 403);

    const empty = await app.inject({
      method: 'PATCH',
      url: `/api/v1/posts/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { content: '   ' },
    });
    assert.equal(empty.statusCode, 400);

    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/v1/posts/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { title: 'Updated title', content: 'Second draft #final' },
    });
    assert.equal(ok.statusCode, 200);
    const body = ok.json();
    assert.equal(body.title, 'Updated title');
    assert.equal(body.edited, true);
    assert.deepEqual(body.hashtags, ['#final']);

    const anon = await app.inject({
      method: 'PATCH',
      url: `/api/v1/posts/${id}`,
      payload: { content: 'anonymous' },
    });
    assert.ok(anon.statusCode === 401 || anon.statusCode === 403);
  });

  test('only the author can delete a post through the student route', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/posts',
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { space: 'public', type: 'Discussion', content: 'Delete me' },
    });
    const id = created.json().id as string;

    const byOther = await app.inject({
      method: 'DELETE',
      url: `/api/v1/posts/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    assert.equal(byOther.statusCode, 403);

    const byOwner = await app.inject({
      method: 'DELETE',
      url: `/api/v1/posts/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(byOwner.statusCode, 200);

    const again = await app.inject({
      method: 'PATCH',
      url: `/api/v1/posts/${id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { content: 'zombie edit' },
    });
    assert.equal(again.statusCode, 404);
  });
});

describe('Production safety defaults', () => {
  const constantsUrl = pathToUrl(path.join(BACKEND_DIR, 'src/config/constants.ts'));

  function pathToUrl(p: string): string {
    return new URL(`file://${p}`).href;
  }

  test('refuses to start in production without a strong AUTH_SECRET', () => {
    const res = runInChild(`await import(${JSON.stringify(constantsUrl)});`, { NODE_ENV: 'production' });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /AUTH_SECRET must be set/);

    const weak = runInChild(`await import(${JSON.stringify(constantsUrl)});`, {
      NODE_ENV: 'production',
      AUTH_SECRET: 'replace-with-32-byte-random-hex-secret',
    });
    assert.notEqual(weak.status, 0);
  });

  test('production without an explicit admin password creates no accounts and no demo data', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-prod-a-'));
    const script = `
      const { buildApp } = await import(${JSON.stringify(pathToUrl(path.join(BACKEND_DIR, 'src/app.ts')))});
      const { app, db } = await buildApp({ dbPath: ${JSON.stringify(path.join(tmp, 'p.db'))} });
      const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      const posts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
      console.log(JSON.stringify({ users, posts }));
      await app.close();
    `;
    const res = runInChild(script, { NODE_ENV: 'production', AUTH_SECRET: 'a'.repeat(48) });
    fs.rmSync(tmp, { recursive: true, force: true });
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout.trim().split('\n').pop()!), { users: 0, posts: 0 });
  });

  test('production with an explicit admin password creates only that admin', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quad-prod-b-'));
    const script = `
      const { buildApp } = await import(${JSON.stringify(pathToUrl(path.join(BACKEND_DIR, 'src/app.ts')))});
      const { app, db } = await buildApp({ dbPath: ${JSON.stringify(path.join(tmp, 'p.db'))} });
      const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      const posts = db.prepare('SELECT COUNT(*) AS c FROM posts').get().c;
      const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
        payload: { identifier: 'owner@school.org', password: 'a-long-explicit-password-1' } });
      const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/login',
        payload: { identifier: 'owner@school.org', password: 'Admin@Campus2026' } });
      console.log(JSON.stringify({ users, posts, loginOk: login.statusCode, oldDefault: bad.statusCode,
        role: login.json().user?.role }));
      await app.close();
    `;
    const res = runInChild(script, {
      NODE_ENV: 'production',
      AUTH_SECRET: 'b'.repeat(48),
      MOCK_ADMIN_EMAIL: 'owner@school.org',
      SEED_ADMIN_PASSWORD: 'a-long-explicit-password-1',
      EMAIL_POLICY: 'open',
    });
    fs.rmSync(tmp, { recursive: true, force: true });
    assert.equal(res.status, 0, res.stderr);
    const out = JSON.parse(res.stdout.trim().split('\n').pop()!);
    assert.equal(out.users, 1);
    assert.equal(out.posts, 0);
    assert.equal(out.loginOk, 200);
    assert.equal(out.role, 'admin');
    assert.notEqual(out.oldDefault, 200);
  });
});
