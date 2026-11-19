import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import bcrypt from 'bcrypt';
import { createApp } from '../src/app.js';

test('register, reject duplicates and bad credentials, persist and clear session', async t => {
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const records = [];
  const users = {
    async create(fields) {
      if (records.some(u => u.username === fields.username || u.email === fields.email)) {
        throw Object.assign(new Error(), { code: 11000 });
      }
      const user = { ...fields, _id: randomBytes(12).toString('hex') };
      records.push(user);
      return user;
    },
    findOne({ username }) { return { select: async () => records.find(u => u.username === username) }; },
    async findById(id) { return records.find(u => u._id === id); },
    async updateOne({ _id }, { $max }) {
      Object.assign(records.find(user => user._id === _id), $max);
    },
  };
  const server = createApp({ users }).listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/auth/';
  const request = (path, body, cookie) => fetch(base + path, {
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  const password = 'Fixture password 123';
  const fields = { username: ' Vyora.Test ', email: ' TEST@example.com ', phone: '0900000000', password, passwordConfirmation: password, role: 'admin' };
  assert.equal((await request('me')).status, 401);
  assert.equal((await request('register', { ...fields, passwordConfirmation: 'wrong' })).status, 400);
  const registered = await request('register', fields);
  assert.equal(registered.status, 201);
  const { user } = await registered.json();
  assert.equal(user.username, 'vyora.test');
  assert.equal(user.role, 'user');
  assert.equal(user.passwordHash, undefined);
  assert.ok(await bcrypt.compare(password, records[0].passwordHash));
  assert.equal((await request('register', fields)).status, 409);
  assert.equal((await request('login', { username: user.username, password: 'wrong' })).status, 401);
  const login = await request('login', { username: user.username, password, remember: true });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Max-Age=604800']) assert.ok(cookie.includes(attribute));
  const session = cookie.split(';')[0];
  assert.equal((await (await request('me', undefined, session)).json()).user.id, user.id);
  const logout = await request('logout', {}, session);
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
});
