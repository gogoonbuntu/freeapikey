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

// Groq: minimal call to read rate limit headers
async function checkGroqQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!res.ok) {
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: `HTTP ${res.status}`,
            };
        }

        return {
            remainingRequests: parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests')),
            remainingTokens: parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens')),
            limitRequests: parseHeaderInt(res.headers.get('x-ratelimit-limit-requests')),
            limitTokens: parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens')),
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

// Cerebras: minimal call to read rate limit headers
async function checkCerebrasQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        const res = await fetch('https://api.cerebras.ai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });

        if (!res.ok) {
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: `HTTP ${res.status}`,
            };
        }

        return {
            remainingRequests: parseHeaderInt(res.headers.get('x-ratelimit-remaining-requests-day')),
            remainingTokens: parseHeaderInt(res.headers.get('x-ratelimit-remaining-tokens-minute')),
            limitRequests: parseHeaderInt(res.headers.get('x-ratelimit-limit-requests-day')),
            limitTokens: parseHeaderInt(res.headers.get('x-ratelimit-limit-tokens-minute')),
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

// Gemini: use model list API (no token consumption)
async function checkGeminiQuota(apiKey: string): Promise<QuotaCheckResponse> {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { method: 'GET' }
        );

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errorMsg = errData?.error?.message || `HTTP ${res.status}`;
            return {
                isValid: false,
                checkedAt: new Date().toISOString(),
                error: errorMsg,
            };
        }

        // Gemini doesn't return rate limit headers on the models endpoint.
        // We can only confirm the key is valid.
        return {
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
