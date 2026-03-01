import { NextRequest, NextResponse } from 'next/server';
import { AIProvider, PROVIDER_CONFIG } from '@/lib/types';

export async function POST(req: NextRequest) {
    try {
        const { provider, key, model } = await req.json();

        if (!provider || !key) {
            return NextResponse.json({ error: { message: 'Provider and Key are required' } }, { status: 400 });
        }

        const trimmedKey = key.trim();
        const selectedModel = model || PROVIDER_CONFIG[provider as AIProvider]?.models[0];

        let url = '';
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: any = {};

        if (provider === 'gemini') {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${trimmedKey}`;
            body = { contents: [{ parts: [{ text: 'Ping' }] }] };
        } else if (provider === 'groq') {
            url = 'https://api.groq.com/openai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${trimmedKey}`;
            body = {
                model: selectedModel,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            };
        } else if (provider === 'cerebras') {
            url = 'https://api.cerebras.ai/v1/chat/completions';
            headers['Authorization'] = `Bearer ${trimmedKey}`;
            body = {
                model: selectedModel,
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            };
        } else {
            return NextResponse.json({ error: { message: 'Unsupported provider' } }, { status: 400 });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json({
                error: {
                    message: data.error?.message || `API Error: ${response.status}`,
                    details: data
                }
            }, { status: response.status });
        }

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Proxy Error:', error);
        return NextResponse.json({ error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
    }
}
