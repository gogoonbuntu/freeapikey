import { NextRequest, NextResponse } from 'next/server';
import { AIProvider, PROVIDER_CONFIG } from '@/lib/types';

interface QuotaCheckRequest {
    provider: string;
    apiKey: string;
    model?: string;  // Optional: check quota for a specific model
}

interface QuotaCheckResponse {
    remainingRequests?: number;
    remainingTokens?: number;
    limitRequests?: number;
    limitTokens?: number;
    isValid: boolean;
    checkedAt: string;
    error?: string;
    // Per-model quota breakdown (for providers with different per-model limits)
    perModelQuota?: Record<string, {
        limitRequests: number;
        limitTokens: number;
        remainingRequests?: number;
        remainingTokens?: number;
        isAvailable: boolean;
        error?: string;
    }>;
    // Gemini: extra details from probe
    quotaExhausted?: boolean;
    retryAfterSec?: number;
}

// ============================================
// Groq: per-model quota check via rate-limit headers
// Groq provides x-ratelimit headers that are model-specific.
// We check each model separately to report per-model quotas.
// ============================================
async function checkGroqQuota(apiKey: string): Promise<QuotaCheckResponse> {
    const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
    const perModelQuota: QuotaCheckResponse['perModelQuota'] = {};

    // Check each model in parallel
    const results = await Promise.allSettled(
        models.map(model => checkGroqModel(apiKey, model))
    );

    let totalRemainingReqs = 0;
    let totalLimitReqs = 0;
    let totalRemainingTokens = 0;
    let totalLimitTokens = 0;
    let anyValid = false;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
            perModelQuota[model] = result.value;
            if (result.value.isAvailable) {
                anyValid = true;
                totalRemainingReqs += result.value.remainingRequests || 0;
                totalLimitReqs += result.value.limitRequests;
                totalRemainingTokens += result.value.remainingTokens || 0;
                totalLimitTokens += result.value.limitTokens;
            }
        } else {
            perModelQuota[model] = {
                limitRequests: 0,
                limitTokens: 0,
                isAvailable: false,
                error: result.reason?.message || 'Unknown error',
            };
        }
    }

    return {
        remainingRequests: totalRemainingReqs,
        remainingTokens: totalRemainingTokens,
        limitRequests: totalLimitReqs,
        limitTokens: totalLimitTokens,
        isValid: anyValid,
        checkedAt: new Date().toISOString(),
        perModelQuota,
    };
}

async function checkGroqModel(apiKey: string, model: string): Promise<{
    limitRequests: number;
    limitTokens: number;
    remainingRequests?: number;
    remainingTokens?: number;
    isAvailable: boolean;
    error?: string;
}> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: '.' }],
                max_tokens: 1,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // Groq rate-limit headers:
        // x-ratelimit-limit-requests = daily request limit for this model
        // x-ratelimit-remaining-requests = remaining daily requests
        // x-ratelimit-limit-tokens = per-minute token limit
        // x-ratelimit-remaining-tokens = remaining per-minute tokens
        const limitReqs = parseHeaderInt(res.headers.get('x-ratelimit-limit-requests')) || 0;
        const remainingReqs = parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests'));
        const limitTokensMin = parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens')) || 0;
        const remainingTokensMin = parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens'));

        // Token headers are per-minute. Estimate daily token limit based on known free tier values.
        // Default daily token limit from model config
        const KNOWN_TPD: Record<string, number> = {
            'llama-3.3-70b-versatile': 100000,
            'llama-3.1-8b-instant': 500000,
        };
        const dailyTokenLimit = KNOWN_TPD[model] || limitTokensMin * 60;

        // Estimate daily token remaining ratio from per-minute data
        let remainingTokensDaily: number | undefined;
        if (remainingTokensMin !== undefined && limitTokensMin > 0) {
            const ratio = remainingTokensMin / limitTokensMin;
            remainingTokensDaily = Math.round(ratio * dailyTokenLimit);
        }

        if (!res.ok && res.status === 429) {
            return {
                limitRequests: limitReqs,
                limitTokens: dailyTokenLimit,
                remainingRequests: 0,
                remainingTokens: 0,
                isAvailable: true,  // key is valid, just rate limited
            };
        }

        if (!res.ok) {
            return {
                limitRequests: 0,
                limitTokens: 0,
                isAvailable: false,
                error: `HTTP ${res.status}`,
            };
        }

        return {
            limitRequests: limitReqs,
            limitTokens: dailyTokenLimit,
            remainingRequests: remainingReqs,
            remainingTokens: remainingTokensDaily,
            isAvailable: true,
        };
    } catch (err) {
        return {
            limitRequests: 0,
            limitTokens: 0,
            isAvailable: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================
// Cerebras: daily rate limit headers
// ============================================
async function checkCerebrasQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3.1-8b',
                messages: [{ role: 'user', content: '.' }],
                max_tokens: 1,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            if (res.status === 429) {
                return {
                    remainingRequests: 0,
                    remainingTokens: 0,
                    limitRequests: parseHeaderInt(res.headers.get('x-ratelimit-limit-requests-day')),
                    limitTokens: parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens-day')),
                    isValid: true,
                    checkedAt: new Date().toISOString(),
                };
            }
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: `HTTP ${res.status}`,
            };
        }

        return {
            remainingRequests: parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests-day')),
            remainingTokens: parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens-day')),
            limitRequests: parseHeaderInt(res.headers.get('x-ratelimit-limit-requests-day')),
            limitTokens: parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens-day')),
            isValid: true,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            isValid: false,
            checkedAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================
// Gemini: key validation via models.list (no tokens consumed).
// Then optionally probe per-model availability.
//
// IMPORTANT:
// - Gemini does NOT return x-ratelimit headers.
// - 429 can mean: (a) actual quota exhaustion, (b) per-minute rate limit,
//   (c) model not available on free tier, or (d) billing not configured.
// - The 429 body has `quotaValue` showing the limit and `quotaId` identifying
//   which limit was exceeded.
// - Using models.list to validate key (free, no quota consumed).
// - Using per-model generateContent probes to check actual availability.
// ============================================
async function checkGeminiQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        // Step 1: Validate key via models.list (no quota consumed)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const listRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=5`,
            { method: 'GET', signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!listRes.ok) {
            const errData = await listRes.json().catch(() => ({}));
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: errData?.error?.message || `API key invalid (HTTP ${listRes.status})`,
            };
        }

        // Key is valid. Now probe per-model availability.
        const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
        const perModelQuota: QuotaCheckResponse['perModelQuota'] = {};

        const probeResults = await Promise.allSettled(
            models.map(model => probeGeminiModel(apiKey, model))
        );

        let hasAvailableModel = false;
        let aggregatedLimitRequests = 0;
        let aggregatedLimitTokens = 0;

        for (let i = 0; i < models.length; i++) {
            const model = models[i];
            const result = probeResults[i];
            if (result.status === 'fulfilled') {
                const probe = result.value;
                perModelQuota[model] = probe;
                if (probe.isAvailable) {
                    hasAvailableModel = true;
                }
                aggregatedLimitRequests += probe.limitRequests;
                aggregatedLimitTokens += probe.limitTokens;
            } else {
                perModelQuota[model] = {
                    limitRequests: 0,
                    limitTokens: 0,
                    isAvailable: false,
                    error: 'Probe failed',
                };
            }
        }

        return {
            // For Gemini, we can't report exact "remaining" from headers.
            // The probe tells us if quota is available per model.
            limitRequests: aggregatedLimitRequests,
            limitTokens: aggregatedLimitTokens,
            isValid: true,
            checkedAt: new Date().toISOString(),
            quotaExhausted: !hasAvailableModel,
            perModelQuota,
        };
    } catch (err) {
        return {
            isValid: false,
            checkedAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

async function probeGeminiModel(apiKey: string, model: string): Promise<{
    limitRequests: number;
    limitTokens: number;
    remainingRequests?: number;
    remainingTokens?: number;
    isAvailable: boolean;
    error?: string;
}> {
    // Known free tier defaults per model
    const KNOWN_LIMITS: Record<string, { rpd: number; tpd: number }> = {
        'gemini-2.5-flash':      { rpd: 500,  tpd: 50000000 },
        'gemini-2.5-flash-lite': { rpd: 1000, tpd: 50000000 },
        'gemini-2.5-pro':        { rpd: 50,   tpd: 50000000 },
    };

    const defaults = KNOWN_LIMITS[model] || { rpd: 500, tpd: 50000000 };

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: '.' }] }],
                    generationConfig: { maxOutputTokens: 1 },
                }),
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        if (res.ok) {
            // Model available and working
            return {
                limitRequests: defaults.rpd,
                limitTokens: defaults.tpd,
                isAvailable: true,
            };
        }

        if (res.status === 429) {
            // Parse the error to distinguish:
            // - PerDay quota exhaustion (actually used up)
            // - PerMinute rate limit (temporary, retry soon)
            // - limit: 0 (model not available on free tier / billing issue)
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData?.error?.message || '';
            const violations = errData?.error?.details?.find(
                (d: any) => d['@type']?.includes('QuotaFailure')
            )?.violations || [];

            const retryInfo = errData?.error?.details?.find(
                (d: any) => d['@type']?.includes('RetryInfo')
            );
            const retryMatch = errMsg.match(/retry in ([\d.]+)s/i);
            const retryAfterSec = retryMatch ? parseFloat(retryMatch[1]) : undefined;

            // Check if limit is 0 → model not available on this tier
            let isDailyExhausted = false;
            let isMinuteExhausted = false;
            let actualLimit: number | undefined;

            for (const v of violations) {
                const qid = v.quotaId || '';
                const qval = parseInt(v.quotaValue || '0', 10);

                if (qid.includes('PerDay')) {
                    isDailyExhausted = true;
                    if (qval > 0) actualLimit = qval;
                }
                if (qid.includes('PerMinute')) {
                    isMinuteExhausted = true;
                }
            }

            // If only per-minute limit hit but daily is fine → model is still available
            if (isMinuteExhausted && !isDailyExhausted) {
                return {
                    limitRequests: actualLimit || defaults.rpd,
                    limitTokens: defaults.tpd,
                    isAvailable: true, // Just temporarily rate limited
                };
            }

            // Check for "limit: 0" → model not available on free tier
            const hasZeroLimit = violations.some((v: any) =>
                parseInt(v.quotaValue || '0', 10) === 0
            );

            if (hasZeroLimit) {
                return {
                    limitRequests: 0,
                    limitTokens: 0,
                    isAvailable: false,
                    error: 'Model not available on current tier (limit: 0)',
                };
            }

            // Daily quota genuinely exhausted
            return {
                limitRequests: actualLimit || defaults.rpd,
                limitTokens: defaults.tpd,
                remainingRequests: 0,
                remainingTokens: 0,
                isAvailable: true, // key valid, just exhausted for today
                error: `Daily quota exhausted${retryAfterSec ? ` (retry in ${Math.round(retryAfterSec)}s)` : ''}`,
            };
        }

        // Other HTTP errors (404 model not found, etc.)
        const errData = await res.json().catch(() => ({}));
        return {
            limitRequests: 0,
            limitTokens: 0,
            isAvailable: false,
            error: errData?.error?.message || `HTTP ${res.status}`,
        };
    } catch (err) {
        return {
            limitRequests: defaults.rpd,
            limitTokens: defaults.tpd,
            isAvailable: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================
// Generic OpenAI-compatible quota check
// Works for: SambaNova, OpenRouter, Mistral
// Makes a minimal 1-token request and reads rate-limit headers.
// ============================================
async function checkOpenAICompatQuota(apiKey: string, provider: AIProvider): Promise<QuotaCheckResponse> {
    const config = PROVIDER_CONFIG[provider];
    if (!config?.baseUrl || !config.models[0]) {
        return { isValid: false, checkedAt: new Date().toISOString(), error: 'No baseUrl or models configured' };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        };
        if (provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://freeapi-hub.vercel.app';
            headers['X-Title'] = 'FreeAPI Hub';
        }

        const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: config.models[0],
                messages: [{ role: 'user', content: '.' }],
                max_tokens: 1,
            }),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        // Try to parse rate-limit headers (various naming conventions)
        const limitReqs = parseHeaderInt(res.headers.get('x-ratelimit-limit-requests'))
            ?? parseHeaderInt(res.headers.get('x-ratelimit-limit-requests-day'));
        const remainReqs = parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests'))
            ?? parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests-day'));
        const limitTokens = parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens'))
            ?? parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens-day'));
        const remainTokens = parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens'))
            ?? parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens-day'));

        if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
                return {
                    isValid: false,
                    checkedAt: new Date().toISOString(),
                    error: 'Invalid API key',
                };
            }
            if (res.status === 429) {
                return {
                    remainingRequests: 0,
                    remainingTokens: 0,
                    limitRequests: limitReqs || config.defaultLimits.rpd,
                    limitTokens: limitTokens || config.defaultLimits.tpd,
                    isValid: true,
                    checkedAt: new Date().toISOString(),
                };
            }
            // Other errors - key might still be valid
            const errData = await res.json().catch(() => ({}));
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: errData?.error?.message || `HTTP ${res.status}`,
            };
        }

        return {
            remainingRequests: remainReqs,
            remainingTokens: remainTokens,
            limitRequests: limitReqs || config.defaultLimits.rpd,
            limitTokens: limitTokens || config.defaultLimits.tpd,
            isValid: true,
            checkedAt: new Date().toISOString(),
        };
    } catch (err) {
        return {
            isValid: false,
            checkedAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

function parseHeaderInt(value: string | null): number | undefined {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    return isNaN(num) ? undefined : num;
}

export async function POST(request: NextRequest) {
    try {
        const body: QuotaCheckRequest = await request.json();
        const { provider, apiKey } = body;

        if (!provider || !apiKey) {
            return NextResponse.json(
                { error: 'provider and apiKey are required' },
                { status: 400 }
            );
        }

        let result: QuotaCheckResponse;

        switch (provider) {
            case 'groq':
                result = await checkGroqQuota(apiKey);
                break;
            case 'cerebras':
                result = await checkCerebrasQuota(apiKey);
                break;
            case 'gemini':
                result = await checkGeminiQuota(apiKey);
                break;
            case 'sambanova':
            case 'openrouter':
            case 'mistral':
                result = await checkOpenAICompatQuota(apiKey, provider as AIProvider);
                break;
            default:
                result = {
                    isValid: false,
                    checkedAt: new Date().toISOString(),
                    error: `Unsupported provider: ${provider}`,
                };
        }

        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal error' },
            { status: 500 }
        );
    }
}
