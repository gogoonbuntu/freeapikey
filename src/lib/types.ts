export type AIProvider = 'gemini' | 'groq' | 'cerebras' | 'custom';

export interface ApiKey {
    id: string;
    provider: AIProvider;
    key: string;
    label: string;
    limits: ProviderLimits;
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

export const PROVIDER_CONFIG: Record<AIProvider, {
    name: string;
    color: string;
    gradient: string;
    defaultLimits: ProviderLimits;
    models: string[];
    costPer1MInput: number;
    costPer1MOutput: number;
}> = {
    gemini: {
        name: 'Google Gemini',
        color: '#4285F4',
        gradient: 'linear-gradient(135deg, #4285F4, #34A853)',
        defaultLimits: { rpm: 15, rpd: 1500, tpm: 1000000, tpd: 50000000 },
        models: ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        costPer1MInput: 1.25,
        costPer1MOutput: 5.0,
    },
    groq: {
        name: 'Groq Cloud',
        color: '#F55036',
        gradient: 'linear-gradient(135deg, #F55036, #FF8A65)',
        defaultLimits: { rpm: 30, rpd: 14400, tpm: 6000, tpd: 500000 },
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it'],
        costPer1MInput: 0.05,
        costPer1MOutput: 0.08,
    },
    cerebras: {
        name: 'Cerebras',
        color: '#8B5CF6',
        gradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
        defaultLimits: { rpm: 30, rpd: 900, dailyTokenLimit: 1000000 },
        models: ['llama3.1-8b', 'llama-3.3-70b'],
        costPer1MInput: 0.10,
        costPer1MOutput: 0.10,
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
