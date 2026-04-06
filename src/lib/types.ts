export type AIProvider = 'gemini' | 'groq' | 'cerebras' | 'sambanova' | 'openrouter' | 'mistral' | 'custom';

// Active providers list (used for dashboard, debate, playground iteration)
export const ACTIVE_PROVIDERS: AIProvider[] = ['groq', 'cerebras', 'sambanova', 'openrouter', 'mistral', 'gemini'];

export interface ApiKey {
    id: string;
    provider: AIProvider;
    key: string;
    label: string;
    limits: ProviderLimits;
    quotaStatus?: QuotaStatus;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProviderLimits {
    rpm?: number;       // Requests per minute
    rpd?: number;       // Requests per day
    tpm?: number;       // Tokens per minute
    tpd?: number;       // Tokens per day
    dailyTokenLimit?: number;
}

export interface QuotaStatus {
    remainingRequests?: number;
    remainingTokens?: number;
    limitRequests?: number;
    limitTokens?: number;
    isValid: boolean;
    checkedAt: Date;
    error?: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    tags: string[];
    color: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface QALog {
    id: string;
    projectId: string;
    projectName?: string;
    provider: AIProvider;
    model: string;
    prompt: string;
    response: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    latencyMs: number;
    hasSensitiveData: boolean;
    fallbackUsed: boolean;
    fallbackFrom?: AIProvider;
    createdAt: Date;
}

export interface UsageRecord {
    id: string;
    provider: AIProvider;
    date: string; // YYYY-MM-DD
    requestCount: number;
    tokenCount: number;
    projectId?: string;
}

export interface UsageSummary {
    provider: AIProvider;
    todayRequests: number;
    todayTokens: number;
    limits: ProviderLimits;
    status: 'normal' | 'warning' | 'exceeded';
}

export interface CostSimulation {
    provider: AIProvider;
    inputTokens: number;
    outputTokens: number;
    estimatedCost: number;
}

// Per-model limits for providers that differ by model
export interface ModelLimits {
    rpm: number;
    rpd: number;
    tpm: number;
    tpd: number;
}

export const PROVIDER_CONFIG: Record<AIProvider, {
    name: string;
    color: string;
    gradient: string;
    defaultLimits: ProviderLimits;
    models: string[];
    modelLimits?: Record<string, ModelLimits>;
    baseUrl?: string; // Base URL WITHOUT /chat/completions (added by caller)
    costPer1MInput: number;
    costPer1MOutput: number;
    note?: string; // Special policy note
}> = {
    gemini: {
        name: 'Google Gemini',
        color: '#4285F4',
        gradient: 'linear-gradient(135deg, #4285F4, #34A853)',
        defaultLimits: { rpm: 10, rpd: 500, tpm: 250000, tpd: 50000000 },
        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        modelLimits: {
            'gemini-2.5-flash':      { rpm: 10, rpd: 500,  tpm: 250000, tpd: 50000000 },
            'gemini-2.5-flash-lite': { rpm: 15, rpd: 1500, tpm: 250000, tpd: 50000000 },
        },
        costPer1MInput: 0.15,
        costPer1MOutput: 0.60,
        note: 'Free tier. Limits per Google Cloud project.',
    },
    groq: {
        name: 'Groq Cloud',
        color: '#F55036',
        gradient: 'linear-gradient(135deg, #F55036, #FF8A65)',
        defaultLimits: { rpm: 30, rpd: 14400, tpm: 6000, tpd: 500000 },
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
        modelLimits: {
            'llama-3.3-70b-versatile': { rpm: 30, rpd: 1000,  tpm: 6000,  tpd: 100000 },
            'llama-3.1-8b-instant':    { rpm: 30, rpd: 14400, tpm: 6000,  tpd: 500000 },
            'gemma2-9b-it':            { rpm: 30, rpd: 14400, tpm: 15000, tpd: 500000 },
        },
        baseUrl: 'https://api.groq.com/openai/v1',
        costPer1MInput: 0.05,
        costPer1MOutput: 0.08,
        note: 'Free tier. Limits vary per model — check console.groq.com/limits.',
    },
    cerebras: {
        name: 'Cerebras',
        color: '#8B5CF6',
        gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
        defaultLimits: { rpm: 30, rpd: 14400, tpm: 60000, tpd: 1000000, dailyTokenLimit: 1000000 },
        models: ['llama3.1-8b', 'llama-3.3-70b'],
        baseUrl: 'https://api.cerebras.ai/v1',
        costPer1MInput: 0.10,
        costPer1MOutput: 0.10,
        note: 'Free tier: 1M tokens/day. Token bucket replenishment. No credit card needed.',
    },
    sambanova: {
        name: 'SambaNova',
        color: '#FF6B00',
        gradient: 'linear-gradient(135deg, #FF6B00, #FFB800)',
        defaultLimits: { rpm: 10, rpd: 1000, tpm: 100000, tpd: 10000000 },
        models: ['DeepSeek-R1', 'Meta-Llama-3.3-70B-Instruct', 'Qwen2.5-72B-Instruct'],
        baseUrl: 'https://api.sambanova.ai/v1',
        costPer1MInput: 0,
        costPer1MOutput: 0,
        note: '$5 trial credits on signup. Limits vary per model size. Check cloud.sambanova.ai.',
    },
    openrouter: {
        name: 'OpenRouter',
        color: '#6366F1',
        gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        defaultLimits: { rpm: 20, rpd: 50, tpm: 200000, tpd: 10000000 },
        models: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-32b:free'],
        baseUrl: 'https://openrouter.ai/api/v1',
        costPer1MInput: 0,
        costPer1MOutput: 0,
        note: '50 RPD (free). $10+ credit purchase unlocks 1000 RPD. Use :free suffix for free models.',
    },
    mistral: {
        name: 'Mistral AI',
        color: '#FF7000',
        gradient: 'linear-gradient(135deg, #FF7000, #FFB347)',
        defaultLimits: { rpm: 2, rpd: 86400, tpm: 500000, tpd: 1000000000 },
        models: ['mistral-small-latest', 'mistral-large-latest', 'codestral-latest'],
        baseUrl: 'https://api.mistral.ai/v1',
        costPer1MInput: 0,
        costPer1MOutput: 0,
        note: 'Free "Experiment" tier. ~2 RPM. Access to all models. No credit card needed.',
    },
    custom: {
        name: 'Custom',
        color: '#6B7280',
        gradient: 'linear-gradient(135deg, #6B7280, #9CA3AF)',
        defaultLimits: {},
        models: [],
        costPer1MInput: 0,
        costPer1MOutput: 0,
    },
};
