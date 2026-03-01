import { NextRequest, NextResponse } from 'next/server';
import { AIProvider, PROVIDER_CONFIG } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const { provider, key, model, prompt } = await req.json();

        if (!provider || !key) {
            return NextResponse.json({ error: { message: 'Provider and Key are required' } }, { status: 400 });
        }

        const trimmedKey = key.trim();
        const selectedModel = model || PROVIDER_CONFIG[provider as AIProvider]?.models[0];
        const userPrompt = prompt || 'Hello';

        let url = '';
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: any = {};

        const start = Date.now();

        if (provider === 'gemini') {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${trimmedKey}`;
            body = {
                contents: [{ parts: [{ text: userPrompt }] }],
                generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
            };
        } else if (provider === 'groq') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${trimmedKey}`;
            body = {
                model: selectedModel,
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 1024,
                temperature: 0.7
            };
        } else if (provider === 'cerebras') {
            url = 'https://api.cerebras.ai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${trimmedKey}`;
            body = {
                model: selectedModel,
                messages: [{ role: 'user', content: userPrompt }],
                max_tokens: 1024,
                temperature: 0.7
            };
        } else {
            return NextResponse.json({ error: { message: 'Unsupported provider' } }, { status: 400 });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const latencyMs = Date.now() - start;
        const data = await response.json().catch(() => ({}));

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
