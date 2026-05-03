import { test, expect, APIRequestContext, request } from '@playwright/test';

const BASE_URL = 'https://api.restful-api.dev';
const HEADERS  = { 'x-api-key': '9f25286a-c44e-4352-9a40-238fd6a4f618' };

let createdObjectId: string;

test.describe('REST API – /objects', () => {
  let apiContext: APIRequestContext;

  test.beforeAll(async () => {
    apiContext = await request.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: HEADERS,
    });
  });

  test.afterAll(async () => {
    await apiContext.dispose();
  });

  // ── GET ──────────────────────────────────────────────────────────────────────

  test('GET /objects – returns a list of objects', async () => {
    const response = await apiContext.get('/objects');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const item of body) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
    }
  });

  test('GET /objects/1 – returns a single object by ID', async () => {
    const response = await apiContext.get('/objects/1');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('id', '1');
    expect(body).toHaveProperty('name');
  });

  test('GET /objects/nonexistent – returns 404 for unknown ID', async () => {
    const response = await apiContext.get('/objects/nonexistent-id-00000');

    expect(response.status()).toBe(404);
  });

  test('GET /objects?id=3&id=5 – returns objects filtered by IDs', async () => {
    const response = await apiContext.get('/objects?id=3&id=5');

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const obj of body) {
      expect(['3', '5']).toContain(obj.id);
    }
  });

  // ── POST ─────────────────────────────────────────────────────────────────────

  test('POST /objects – creates a new object', async () => {
    const payload = {
      name: 'QA Test Car – Toyota Corolla',
      data: {
        year:  2023,
        color: 'Red',
        type:  'Sedan',
      },
    };

    const response = await apiContext.post('/objects', { data: payload });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name', payload.name);
    expect(body).toHaveProperty('createdAt');

    createdObjectId = body.id;
  });

  // ── PATCH ─────────────────────────────────────────────────────────────────────

  test('PATCH /objects/:id – partially updates an existing object', async () => {
    test.skip(!createdObjectId, 'No object ID available – POST test may have failed');

    const update = { name: 'QA Test Car – Toyota Corolla (Updated)' };

    const response = await apiContext.patch(`/objects/${createdObjectId}`, { data: update });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('id', createdObjectId);
    expect(body).toHaveProperty('name', update.name);
    expect(body).toHaveProperty('updatedAt');
  });

  // ── DELETE ────────────────────────────────────────────────────────────────────

  test('DELETE /objects/:id – deletes an existing object', async () => {
    test.skip(!createdObjectId, 'No object ID available – POST test may have failed');

    const response = await apiContext.delete(`/objects/${createdObjectId}`);

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.message).toMatch(new RegExp(createdObjectId));
  });

  test('DELETE /objects/nonexistent – returns 404 for unknown ID', async () => {
    const response = await apiContext.delete('/objects/nonexistent-id-00000');

    expect(response.status()).toBe(404);
  });
});
