import { keylessHudSummaryResponse } from '../../../src/hudSummaryResponse.js';
import { enforceOptInRateLimit, openAiRateLimiter } from './rate-limit.js';
import { readRequestBody } from '../common/request.js';
import { OPENAI_HUD_SUMMARY_MODEL_DEFAULT } from './constants.js';

const instructions = [
  "Write one concise intelligence-HUD summary for God's Eye View.",
  'Use only supplied place, street, nearby-place and enabled-layer labels.',
  'Do not infer from coordinates or invent a place.',
  'Output exactly five words with no title, punctuation or markdown.',
].join(' ');

function providerSettings(env = process.env) {
  const provider = (env.LLM_PROVIDER || 'ollama').toLowerCase();
  if (provider === 'template') return null;
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY?.trim()) return null;
    return { provider, endpoint: 'https://api.openai.com/v1/responses',
      model: env.OPENAI_HUD_SUMMARY_MODEL || OPENAI_HUD_SUMMARY_MODEL_DEFAULT,
      apiKey: env.OPENAI_API_KEY };
  }
  if (!['ollama', 'local'].includes(provider)) throw new Error('Unknown LLM_PROVIDER');
  const base = env.LLM_BASE_URL || env.OLLAMA_URL;
  if (!base) return null;
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol)
      || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash
      || !['', '/', '/v1', '/v1/'].includes(url.pathname)) {
    throw new Error('Local AI requires a loopback /v1 URL without credentials');
  }
  const model = env.LLM_MODEL || 'qwen3.5:4b';
  if (!model.trim() || model.toLowerCase().includes('cloud')) throw new Error('A local model is required');
  const endpoint = base.replace(/\/$/, '') + (url.pathname.replace(/\/$/, '') ? '' : '/v1')
    + '/chat/completions';
  return { provider, endpoint, model };
}

function extractResponseText(data) {
  if (typeof data?.choices?.[0]?.message?.content === 'string') return data.choices[0].message.content;
  if (typeof data?.output_text === 'string') return data.output_text;
  return (Array.isArray(data?.output) ? data.output : [])
    .flatMap((item) => Array.isArray(item?.content) ? item.content : [])
    .map((part) => part?.text || part?.output_text || '').join(' ');
}

function toFiveWordHudSummary(value) {
  return String(value || '').replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim()
    .split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
}

async function requestHudSummary(context, { env = process.env, fetchImpl = (...args) => fetch(...args) } = {}) {
  const settings = providerSettings(env);
  if (!settings) return null;
  const local = settings.provider !== 'openai';
  const headers = { 'Content-Type': 'application/json' };
  if (!local) headers.Authorization = 'Bearer ' + settings.apiKey;
  const payload = local
    ? { model: settings.model, stream: false, temperature: 0.2, max_tokens: 256,
      messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(context) }] }
    : { model: settings.model, instructions, input: JSON.stringify(context),
      reasoning: { effort: 'minimal' }, max_output_tokens: 100 };
  const response = await fetchImpl(settings.endpoint, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers, body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'HUD model request failed');
  const summary = toFiveWordHudSummary(extractResponseText(data));
  if (!summary) throw new Error('HUD model returned no summary');
  return summary;
}

async function handleHudSummary(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  try {
    const settings = providerSettings();
    if (!settings) {
      const keyless = keylessHudSummaryResponse(undefined);
      res.statusCode = keyless.statusCode;
      res.end(JSON.stringify(keyless.payload));
      return;
    }
    if (!enforceOptInRateLimit(openAiRateLimiter(), req, res)) return;
    const body = await readRequestBody(req, 64 * 1024);
    const summary = await requestHudSummary(JSON.parse(body || '{}'));
    res.statusCode = 200;
    res.end(JSON.stringify({ summary, error: null }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: error?.message || 'HUD model request failed' }));
  }
}

export { handleHudSummary, requestHudSummary };
