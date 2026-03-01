import { AIProvider, PROVIDER_CONFIG } from './types';

// API Keys from environment variables
const API_KEYS: Record<string, string> = {
    gemini: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
    groq: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
    cerebras: process.env.NEXT_PUBLIC_CEREBRAS_API_KEY || '',
};

// Fallback order
const FALLBACK_ORDER: AIProvider[] = ['gemini', 'groq', 'cerebras'];

interface AIRequest {
    prompt: string;
    provider?: AIProvider;
    model?: string;
    projectId?: string;
}

interface AIResponse {
    text: string;
    provider: AIProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    fallbackUsed: boolean;
    fallbackFrom?: AIProvider;
}

// === Gemini API ===
async function callGemini(prompt: string, model: string = 'gemini-2.5-flash-lite'): Promise<AIResponse> {
    const start = Date.now();
    const apiKey = API_KEYS.gemini;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.7,
                },
            }),
        }
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Gemini API error ${res.status}: ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
        text,
        provider: 'gemini',
        model,
        inputTokens: usage.promptTokenCount || Math.ceil(prompt.length / 4),
        outputTokens: usage.candidatesTokenCount || Math.ceil(text.length / 4),
        totalTokens: usage.totalTokenCount || Math.ceil((prompt.length + text.length) / 4),
        latencyMs,
        fallbackUsed: false,
    };
}

// === Groq API ===
async function callGroq(prompt: string, model: string = 'llama-3.3-70b-versatile'): Promise<AIResponse> {
    const start = Date.now();
    const apiKey = API_KEYS.groq;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2048,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Groq API error ${res.status}: ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;
    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
        text,
        provider: 'groq',
        model,
        inputTokens: usage.prompt_tokens || Math.ceil(prompt.length / 4),
        outputTokens: usage.completion_tokens || Math.ceil(text.length / 4),
        totalTokens: usage.total_tokens || Math.ceil((prompt.length + text.length) / 4),
        latencyMs,
        fallbackUsed: false,
    };
}

// === Cerebras API ===
async function callCerebras(prompt: string, model: string = 'llama3.1-8b'): Promise<AIResponse> {
    const start = Date.now();
    const apiKey = API_KEYS.cerebras;

    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2048,
            temperature: 0.7,
        }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Cerebras API error ${res.status}: ${JSON.stringify(err)}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - start;
    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
        text,
        provider: 'cerebras',
        model,
        inputTokens: usage.prompt_tokens || Math.ceil(prompt.length / 4),
        outputTokens: usage.completion_tokens || Math.ceil(text.length / 4),
        totalTokens: usage.total_tokens || Math.ceil((prompt.length + text.length) / 4),
        latencyMs,
        fallbackUsed: false,
    };
}

// === Provider dispatcher ===
async function callProvider(prompt: string, provider: AIProvider, model?: string): Promise<AIResponse> {
    switch (provider) {
        case 'gemini':
            return callGemini(prompt, model || 'gemini-2.5-flash-lite');
        case 'groq':
            return callGroq(prompt, model || 'llama-3.3-70b-versatile');
        case 'cerebras':
            return callCerebras(prompt, model || 'llama3.1-8b');
        default:
            throw new Error(`Unknown provider: ${provider}`);
    }
}

// === Exponential Backoff ===
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            // Only retry on rate limit (429) errors
            const errStr = lastError.message;
            if (!errStr.includes('429') && !errStr.includes('rate') && !errStr.includes('Rate')) {
                throw lastError;
            }
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
                console.log(`Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// === Smart AI Proxy (with fallback) ===
export async function smartAICall(request: AIRequest): Promise<AIResponse> {
    const { prompt, provider, model } = request;

    // If specific provider requested, try with retry then fallback
    if (provider) {
        try {
            return await withRetry(() => callProvider(prompt, provider, model));
        } catch (err) {
            console.warn(`Provider ${provider} failed, attempting fallback...`);
            // Fallback to next provider
            const fallbackProviders = FALLBACK_ORDER.filter(p => p !== provider);
            for (const fallbackProvider of fallbackProviders) {
                try {
                    const result = await callProvider(prompt, fallbackProvider);
                    result.fallbackUsed = true;
                    result.fallbackFrom = provider;
                    return result;
                } catch (fallbackErr) {
                    console.warn(`Fallback to ${fallbackProvider} also failed`);
                    continue;
                }
            }
            throw err;
        }
    }

    // No provider specified - try in order
    let lastError: Error | null = null;
    for (const p of FALLBACK_ORDER) {
        try {
            return await withRetry(() => callProvider(prompt, p));
        } catch (err: unknown) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.warn(`Provider ${p} failed:`, lastError.message);
            continue;
        }
    }

    throw lastError || new Error('All providers failed');
}

// === Sensitive data detection ===
export function checkSensitiveData(text: string): boolean {
    const patterns = [
        /\b\d{3}-\d{2}-\d{4}\b/,         // SSN
        /\b\d{13,16}\b/,                   // Credit card
        /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, // Email
        /비밀번호|password|secret|토큰|token/i,
        /주민등록|사번|계좌/,
    ];
    return patterns.some(p => p.test(text));
}

export function getAvailableModels(provider: AIProvider): string[] {
    return PROVIDER_CONFIG[provider]?.models || [];
}

export function getDefaultModel(provider: AIProvider): string {
    const models = getAvailableModels(provider);
    return models[0] || '';
}
