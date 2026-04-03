import { NextRequest, NextResponse } from 'next/server';

interface QuotaCheckRequest {
    provider: string;
    apiKey: string;
}

interface QuotaCheckResponse {
    remainingRequests?: number;
    remainingTokens?: number;
    limitRequests?: number;
    limitTokens?: number;
    isValid: boolean;
    checkedAt: string;
    error?: string;
}

// Groq: minimal chat completion call to read rate limit headers
// Groq: request headers are daily limits, token headers are per-minute.
async function checkGroqQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: '.' }],
                max_tokens: 1,
            }),
        });

        if (!res.ok) {
            // 429 still carries rate limit headers — read them
            if (res.status === 429) {
                return {
                    remainingRequests: 0,
                    remainingTokens: 0,
                    // Request limits are daily
                    limitRequests: parseHeaderInt(res.headers.get('x-ratelimit-limit-requests')),
                    // Token limits are per-minute; use configured daily default
                    limitTokens: 500000,
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

        // Request headers are daily limits (e.g. 14400/day)
        const remainingRequests = parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests'));
        const limitRequests = parseHeaderInt(res.headers.get('x-ratelimit-limit-requests'));
        // Token headers are per-minute (e.g. 6000/min) — not useful for daily display
        // We don't have daily token limit from Groq, use configured default
        const remainingTokensPerMin = parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens'));
        const limitTokensPerMin = parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens'));

        // Estimate daily token remaining ratio from per-minute data
        const dailyTokenLimit = 500000; // Groq free tier default
        let remainingTokensDaily: number | undefined;
        if (remainingTokensPerMin !== undefined && limitTokensPerMin) {
            const ratio = remainingTokensPerMin / limitTokensPerMin;
            remainingTokensDaily = Math.round(ratio * dailyTokenLimit);
        }

        return {
            remainingRequests,
            remainingTokens: remainingTokensDaily,
            limitRequests,
            limitTokens: dailyTokenLimit,
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

// Cerebras: minimal chat completion call to read rate limit headers
// Cerebras provides daily + minute + hourly headers. We use daily.
async function checkCerebrasQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
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
        });

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

// Gemini: use model list API (no token consumption, fast)
// Gemini doesn't expose rate limit headers, so we validate the key
// and use the free tier defaults for display.
async function checkGeminiQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { method: 'GET', signal: controller.signal }
        );
        clearTimeout(timeout);

        if (!res.ok) {
            if (res.status === 429) {
                return {
                    remainingRequests: 0,
                    remainingTokens: 0,
                    limitRequests: 1500,
                    limitTokens: 50000000,
                    isValid: true,
                    checkedAt: new Date().toISOString(),
                };
            }
            const errData = await res.json().catch(() => ({}));
            const errorMsg = errData?.error?.message || `HTTP ${res.status}`;
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: errorMsg,
            };
        }

        // Key is valid. Use default free tier limits.
        return {
            limitRequests: 1500,
            limitTokens: 50000000,
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
