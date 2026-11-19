export interface GeminiInlineDataPart {
  inline_data: {
    mime_type: string;
    data: string;
  };
}

export interface GeminiTextPart {
  text: string;
}

export type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

export interface CallGeminiJsonOptions {
  parts: GeminiPart[];
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  logContext?: string;
}

export interface CallGeminiJsonResult<T = unknown> {
  success: boolean;
  data?: T;
  status: number;
  message?: string;
  isRateLimited?: boolean;
}

// Short in-memory cooldown for models currently returning 503 / timing out
const modelCooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

function extractCleanJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    return trimmed.substring(start, end + 1).trim();
  }

  return trimmed;
}

export async function callGeminiJson<T = unknown>({
  parts,
  temperature = 0.2,
  maxOutputTokens,
  timeoutMs = 12000,
  logContext = 'Gemini API',
}: CallGeminiJsonOptions): Promise<CallGeminiJsonResult<T>> {
  const apiKey = (process.env.AI_API_KEY || '').trim();
  const baseUrl = (
    process.env.AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta'
  ).trim();

  if (!apiKey) {
    return {
      success: false,
      status: 400,
      message: 'AI_API_KEY belum diatur di Environment Variables.',
    };
  }

  const primaryModel = (process.env.AI_MODEL || 'gemini-flash-latest').trim();
  const allCandidates = Array.from(
    new Set([
      primaryModel,
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
    ])
  );

  // Move models that recently returned 503/timeout to the back so requests stay fast
  const now = Date.now();
  const healthyModels = allCandidates.filter(
    (m) => (modelCooldownUntil.get(m) || 0) <= now
  );
  const cooledModels = allCandidates.filter(
    (m) => (modelCooldownUntil.get(m) || 0) > now
  );
  const candidateModels = [...healthyModels, ...cooledModels];

  let rawText: string | null = null;
  let lastErrorStatus = 500;
  let lastErrorMessage = 'Layanan AI sedang sibuk. Silakan coba beberapa saat lagi.';
  let isRateLimited = false;

  for (const modelToTry of candidateModels) {
    try {
      const endpoint = `${baseUrl}/models/${modelToTry}:generateContent?key=${apiKey}`;

      const generationConfig: Record<string, unknown> = {
        response_mime_type: 'application/json',
        temperature,
      };
      if (typeof maxOutputTokens === 'number') {
        generationConfig.maxOutputTokens = maxOutputTokens;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `${logContext} error (model: ${modelToTry}, status: ${response.status}):`,
          errorText
        );
        lastErrorStatus = response.status;

        if (response.status === 429) {
          isRateLimited = true;
          lastErrorMessage =
            'Batas penggunaan AI harian/menit telah tercapai. Silakan tunggu beberapa saat lalu coba kembali.';
          modelCooldownUntil.set(modelToTry, Date.now() + COOLDOWN_MS);
        } else if (response.status === 503) {
          lastErrorMessage =
            'Layanan AI sedang mengalami lonjakan beban. Silakan coba sesaat lagi.';
          modelCooldownUntil.set(modelToTry, Date.now() + COOLDOWN_MS);
        }

        // Immediately fail over to the next candidate model instead of blocking on retries
        continue;
      }

      const result = await response.json();
      const responseParts = result.candidates?.[0]?.content?.parts;

      if (Array.isArray(responseParts) && responseParts.length > 0) {
        let combined = '';
        for (const p of responseParts) {
          if (p && typeof p.text === 'string') {
            combined += p.text;
          }
        }
        if (combined.trim()) {
          rawText = extractCleanJson(combined);
          modelCooldownUntil.delete(modelToTry);
          break;
        }
      }
    } catch (fetchErr: unknown) {
      const errName = fetchErr instanceof Error ? fetchErr.name : '';
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      console.warn(`${logContext} model ${modelToTry} failed (${errName}):`, errMsg);

      if (errName === 'TimeoutError' || errName === 'AbortError') {
        modelCooldownUntil.set(modelToTry, Date.now() + COOLDOWN_MS);
        lastErrorStatus = 504;
        lastErrorMessage = 'Respon model AI melampaui batas waktu. Mencoba model lain...';
      }
    }
  }

  if (!rawText) {
    return {
      success: false,
      status: isRateLimited ? 429 : lastErrorStatus || 500,
      isRateLimited,
      message: lastErrorMessage,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    return {
      success: true,
      status: 200,
      data: parsed,
    };
  } catch (parseErr) {
    console.error(`${logContext} JSON parse error:`, parseErr, 'Raw:', rawText);
    return {
      success: false,
      status: 500,
      message: 'Hasil dari AI tidak dalam format yang valid. Silakan coba lagi.',
    };
  }
}
