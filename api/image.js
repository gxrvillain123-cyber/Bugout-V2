const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';
const DEFAULT_IMAGE_PROVIDER = 'pollinations';
const DEFAULT_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_FALLBACK_IMAGE_MODEL = 'dall-e-3';
const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_IMAGE_QUALITY = 'medium';
const DALLE_3_MODEL = 'dall-e-3';
const DALLE_2_MODEL = 'dall-e-2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required.' });
    }

    const provider = String(body.provider || process.env.IMAGE_PROVIDER || DEFAULT_IMAGE_PROVIDER).trim().toLowerCase();
    if (provider !== 'openai') {
      return res.status(200).json(buildPollinationsImageResult(prompt, body));
    }

    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    }
    if (apiKey === 'your_openai_api_key_here' || apiKey.includes('OPENAI_API_KEY=')) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is set incorrectly. In Vercel, use name OPENAI_API_KEY and value only the secret key, like sk-proj-...'
      });
    }

    const primaryModel = normalizeImageModel(body.model || process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL);
    const fallbackModel = normalizeImageModel(process.env.OPENAI_IMAGE_FALLBACK_MODEL || DEFAULT_FALLBACK_IMAGE_MODEL);
    const attempts = uniqueModels([primaryModel, fallbackModel]);
    let lastFailure = null;
    let payload = null;
    let data = null;

    for (const model of attempts) {
      payload = buildImagePayload(body, prompt, model);
      const upstream = await fetch(OPENAI_IMAGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      data = await upstream.json().catch(() => ({}));
      if (upstream.ok) break;

      lastFailure = {
        status: upstream.status,
        model,
        message: readOpenAIError(data, upstream.status)
      };

      if (upstream.status === 401 || !shouldTryFallback(lastFailure, attempts, model)) {
        if (upstream.status === 401) {
          return res.status(401).json({
            error: 'OpenAI authentication failed. Check that Vercel OPENAI_API_KEY is a real OpenAI API key, not the placeholder, then redeploy.'
          });
        }
        const billingLimited = isBillingLimitError(lastFailure.message);
        return res.status(billingLimited ? 402 : upstream.status).json({
          error: addModelContext(lastFailure.message, model),
          code: billingLimited ? 'openai_billing_limit' : 'openai_image_error'
        });
      }
    }

    const image = data.data?.[0];
    const imageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url;
    if (!imageUrl) {
      return res.status(502).json({ error: 'Image generation returned no image data.' });
    }

    return res.status(200).json({
      image: imageUrl,
      prompt,
      revised_prompt: image.revised_prompt || data.revised_prompt || null,
      model: payload.model,
      size: payload.size,
      quality: payload.quality,
      fallback_used: Boolean(lastFailure && payload.model !== lastFailure.model)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Image generation request failed.' });
  }
}

function normalizeImageModel(model) {
  const value = String(model || '').trim();
  if (!value) return DEFAULT_IMAGE_MODEL;
  const lower = value.toLowerCase();
  if (lower === 'dalle-3' || lower === 'dall-e3') return DALLE_3_MODEL;
  if (lower === 'dalle-2' || lower === 'dall-e2') return DALLE_2_MODEL;
  return value;
}

function uniqueModels(models) {
  const seen = new Set();
  return models.filter(model => {
    const key = model.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPollinationsImageResult(prompt, body) {
  const dimensions = pollinationsDimensions(body.size || DEFAULT_IMAGE_SIZE);
  const seed = Number.isInteger(Number(body.seed))
    ? Math.abs(Number(body.seed))
    : Math.floor(Math.random() * 1000000000);
  const params = new URLSearchParams({
    width: String(dimensions.width),
    height: String(dimensions.height),
    seed: String(seed),
    nologo: 'true'
  });

  return {
    image: `${POLLINATIONS_IMAGE_URL}/${encodeURIComponent(prompt.slice(0, 1200))}?${params.toString()}`,
    prompt,
    revised_prompt: null,
    model: 'pollinations-free',
    provider: 'pollinations',
    size: `${dimensions.width}x${dimensions.height}`,
    quality: 'free'
  };
}

function pollinationsDimensions(size) {
  if (size === '1536x1024') return { width: 1024, height: 768 };
  if (size === '1024x1536') return { width: 768, height: 1024 };
  return { width: 1024, height: 1024 };
}

function buildImagePayload(body, prompt, model) {
  const requestedSize = body.size || DEFAULT_IMAGE_SIZE;
  const requestedQuality = body.quality || DEFAULT_IMAGE_QUALITY;
  const base = {
    model,
    prompt: prompt.slice(0, 4000),
    n: 1
  };

  if (model === DALLE_3_MODEL) {
    return {
      ...base,
      size: normalizeDalle3Size(requestedSize),
      quality: normalizeDalle3Quality(requestedQuality),
      response_format: 'b64_json'
    };
  }

  if (model === DALLE_2_MODEL) {
    return {
      ...base,
      size: ['256x256', '512x512', '1024x1024'].includes(requestedSize) ? requestedSize : DEFAULT_IMAGE_SIZE,
      response_format: 'b64_json'
    };
  }

  return {
    ...base,
    size: normalizeGptImageSize(requestedSize),
    quality: normalizeGptImageQuality(requestedQuality),
    ...(body.background ? { background: body.background } : {}),
    ...(body.moderation ? { moderation: body.moderation } : {})
  };
}

function normalizeGptImageSize(size) {
  return ['1024x1024', '1024x1536', '1536x1024', 'auto'].includes(size) ? size : DEFAULT_IMAGE_SIZE;
}

function normalizeGptImageQuality(quality) {
  return ['low', 'medium', 'high', 'auto'].includes(quality) ? quality : DEFAULT_IMAGE_QUALITY;
}

function normalizeDalle3Size(size) {
  if (size === '1536x1024') return '1792x1024';
  if (size === '1024x1536') return '1024x1792';
  return ['1024x1024', '1024x1792', '1792x1024'].includes(size) ? size : DEFAULT_IMAGE_SIZE;
}

function normalizeDalle3Quality(quality) {
  return ['high', 'hd'].includes(String(quality).toLowerCase()) ? 'hd' : 'standard';
}

function readOpenAIError(data, status) {
  const error = data?.error;
  if (typeof error === 'string') return error;
  return error?.message || data?.message || `Image generation failed (${status})`;
}

function isBillingLimitError(message) {
  return /\b(billing|hard limit|quota|usage limit|insufficient_quota)\b/i.test(String(message || ''));
}

function addModelContext(message, model) {
  return message && message.includes(model) ? message : `${message} [model: ${model}]`;
}

function shouldTryFallback(failure, attempts, model) {
  const isLastAttempt = attempts[attempts.length - 1].toLowerCase() === model.toLowerCase();
  if (isLastAttempt || !failure) return false;
  const message = String(failure.message || '').toLowerCase();
  if (isBillingLimitError(message) || message.includes('rate limit')) return false;
  if (message.includes('content') || message.includes('policy') || message.includes('safety')) return false;
  return [400, 403, 404].includes(failure.status) && (
    message.includes('model') ||
    message.includes('unsupported') ||
    message.includes('quality') ||
    message.includes('size') ||
    message.includes('verification') ||
    message.includes('verify') ||
    message.includes('access')
  );
}
