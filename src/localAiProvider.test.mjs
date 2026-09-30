import test from 'node:test';
import assert from 'node:assert/strict';
import { requestHudSummary } from '../server/providers/openai/hud-summary.js';
import { createRealtimeTokenHandler } from '../server/providers/openai/realtime.js';

test('local HUD uses Qwen even when a legacy OpenAI key exists', async () => {
  let calls = 0;
  const summary = await requestHudSummary({ place: 'Paris' }, {
    env: { LLM_BASE_URL: 'http://127.0.0.1:11434/v1', OPENAI_API_KEY: 'unused' },
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, 'http://127.0.0.1:11434/v1/chat/completions');
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.redirect, 'error');
      assert.equal(JSON.parse(init.body).model, 'qwen3.5:4b');
      return Response.json({ choices: [{ message: { content: 'Paris urban roads under observation' } }] });
    },
  });
  assert.equal(summary, 'Paris urban roads under observation');
  assert.equal(calls, 1);
});

test('unconfigured local HUD makes no provider call even with a key', async () => {
  assert.equal(await requestHudSummary({}, {
    env: { OPENAI_API_KEY: 'unused' },
    fetchImpl: () => assert.fail('unexpected paid request'),
  }), null);
});

test('local failure has no paid fallback', async () => {
  let calls = 0;
  await assert.rejects(requestHudSummary({}, {
    env: { LLM_BASE_URL: 'http://localhost:11434', OPENAI_API_KEY: 'unused' },
    fetchImpl: async () => { calls++; throw new Error('model unavailable'); },
  }), /unavailable/);
  assert.equal(calls, 1);
});

test('hosted, credential-bearing and cloud-model local settings refuse before transport', async () => {
  for (const env of [
    { LLM_BASE_URL: 'https://api.openai.com/v1' },
    { LLM_BASE_URL: 'http://secret@localhost:11434/v1' },
    { LLM_BASE_URL: 'http://localhost:11434/v1?token=x' },
    { LLM_BASE_URL: 'http://localhost:11434/v1', LLM_MODEL: 'qwen-cloud' },
  ]) {
    await assert.rejects(requestHudSummary({}, {
      env, fetchImpl: () => assert.fail('invalid endpoint reached'),
    }), /loopback|local model/);
  }
});

test('realtime cannot bill merely because a key exists', async () => {
  const previous = process.env.LLM_PROVIDER;
  delete process.env.LLM_PROVIDER;
  try {
    const handler = createRealtimeTokenHandler({
      resolveApiKey: () => 'unused',
      fetchImpl: () => assert.fail('unexpected paid realtime request'),
    });
    const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
    await handler({ method: 'GET' }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.body.error, /Local realtime voice/);
  } finally {
    if (previous !== undefined) process.env.LLM_PROVIDER = previous;
  }
});
