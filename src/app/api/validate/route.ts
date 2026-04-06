import { NextRequest, NextResponse } from 'next/server';
import { AIProvider, PROVIDER_CONFIG } from '@/lib/types';

// Build a Gemini API request (supports optional image)
function buildGeminiRequest(model: string, key: string, prompt: string, image?: string, mimeType?: string) {
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];
    if (image && mimeType) {
        parts.push({ inline_data: { mime_type: mimeType, data: image } });
    }
    return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        headers: { 'Content-Type': 'application/json' } as Record<string, string>,
        body: {
            contents: [{ parts }],
            generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        },
    };
}

// Build an OpenAI-compatible API request (supports optional image)
function buildOpenAIRequest(provider: AIProvider, model: string, key: string, prompt: string, image?: string, mimeType?: string) {
    const config = PROVIDER_CONFIG[provider];
    const url = `${config.baseUrl}/chat/completions`;
    if (!config.baseUrl) throw new Error(`No baseUrl for provider: ${provider}`);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
    };

    // OpenRouter requires extra headers
    if (provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://freeapi-hub.vercel.app';
        headers['X-Title'] = 'FreeAPI Hub';
    }

    // Build message content (text-only or multimodal)
    let content: string | Array<Record<string, unknown>> = prompt;
    if (image && mimeType) {
        content = [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } },
        ];
    }

    return {
        url,
        headers,
        body: {
            model,
            messages: [{ role: 'user', content }],
            max_tokens: 1024,
            temperature: 0.7,
        },
    };
}

export async function POST(req: NextRequest) {
    try {
        const { provider, key, model, prompt, image, mimeType } = await req.json();

        if (!provider || !key) {
            return NextResponse.json({ error: { message: 'Provider and Key are required' } }, { status: 400 });
        }

        const trimmedKey = key.trim();
        const config = PROVIDER_CONFIG[provider as AIProvider];
        if (!config) {
            return NextResponse.json({ error: { message: 'Unsupported provider' } }, { status: 400 });
        }

        const selectedModel = model || config.models[0];
        const userPrompt = prompt || 'Hello';

        // Build request based on provider
        let reqConfig: { url: string; headers: Record<string, string>; body: any };
        if (provider === 'gemini') {
            reqConfig = buildGeminiRequest(selectedModel, trimmedKey, userPrompt, image, mimeType);
        } else if (config.baseUrl) {
            // All OpenAI-compatible providers
            reqConfig = buildOpenAIRequest(provider as AIProvider, selectedModel, trimmedKey, userPrompt, image, mimeType);
        } else {
            return NextResponse.json({ error: { message: 'Unsupported provider' } }, { status: 400 });
        }

        const start = Date.now();

        const response = await fetch(reqConfig.url, {
            method: 'POST',
            headers: reqConfig.headers,
            body: JSON.stringify(reqConfig.body),
        });

        const latencyMs = Date.now() - start;
        const data = await response.json().catch(() => ({}));

        // === Gemini 429 Auto-Fallback ===
        if (!response.ok && response.status === 429 && provider === 'gemini') {
            const fallbackModels = config.models.filter(m => m !== selectedModel);
            for (const fallbackModel of fallbackModels) {
                try {
                    const fbReq = buildGeminiRequest(fallbackModel, trimmedKey, userPrompt);
                    const fbStart = Date.now();
                    const fbRes = await fetch(fbReq.url, {
                        method: 'POST',
                        headers: fbReq.headers,
                        body: JSON.stringify(fbReq.body),
                    });
                    const fbLatency = Date.now() - fbStart;
                    const fbData = await fbRes.json().catch(() => ({}));

                    if (fbRes.ok) {
                        const text = fbData.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        const usage = fbData.usageMetadata || {};
                        const inputTokens = usage.promptTokenCount || 0;
                        const outputTokens = usage.candidatesTokenCount || 0;
                        return NextResponse.json({
                            success: true,
                            text,
                            provider,
                            model: fallbackModel,
                            inputTokens,
                            outputTokens,
                            totalTokens: inputTokens + outputTokens,
                            latencyMs: fbLatency,
                            fallbackUsed: true,
                            fallbackFrom: selectedModel,
                            fallbackReason: `${selectedModel} quota exceeded, used ${fallbackModel}`,
                        });
                    }
                } catch {
                    // Continue to next fallback
                }
            }
            return NextResponse.json({
                error: {
                    message: data.error?.message || `API Error: ${response.status}`,
                    details: data,
                    allModelsExhausted: true,
                }
            }, { status: 429 });
        }

        if (!response.ok) {
            return NextResponse.json({
                error: {
                    message: data.error?.message || `API Error: ${response.status}`,
                    details: data
                }
            }, { status: response.status });
        }

        // Extract response text and usage
        let text = '';
        let inputTokens = 0;
        let outputTokens = 0;

        if (provider === 'gemini') {
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const usage = data.usageMetadata || {};
            inputTokens = usage.promptTokenCount || 0;
            outputTokens = usage.candidatesTokenCount || 0;
        } else {
            // All OpenAI-compatible providers use the same response format
            text = data.choices?.[0]?.message?.content || '';
            const usage = data.usage || {};
            inputTokens = usage.prompt_tokens || 0;
            outputTokens = usage.completion_tokens || 0;
        }

        return NextResponse.json({
            success: true,
            text,
            provider,
            model: selectedModel,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            latencyMs,
            fallbackUsed: false,
        });

    } catch (error: any) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
    }
}
