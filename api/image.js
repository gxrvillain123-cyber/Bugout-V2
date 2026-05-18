const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations';
const DEFAULT_IMAGE_MODEL = 'gpt-image-2';
const DEFAULT_IMAGE_SIZE = '1024x1024';
const DEFAULT_IMAGE_QUALITY = 'medium';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

  try {
    const body = req.body || {};
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required.' });
    }

    const payload = {
      model: body.model || process.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: body.size || DEFAULT_IMAGE_SIZE,
      quality: body.quality || DEFAULT_IMAGE_QUALITY,
      ...(body.background ? { background: body.background } : {}),
      ...(body.moderation ? { moderation: body.moderation } : {})
    };

    const upstream = await fetch(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      if (upstream.status === 401) {
        return res.status(401).json({
          error: 'OpenAI authentication failed. Check that Vercel OPENAI_API_KEY is a real OpenAI API key, not the placeholder, then redeploy.'
        });
      }
      return res.status(upstream.status).json({
        error: data.error?.message || `Image generation failed (${upstream.status})`
      });
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
      quality: payload.quality
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Image generation request failed.' });
  }
}
