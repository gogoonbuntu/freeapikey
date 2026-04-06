import { AIProvider, PROVIDER_CONFIG } from './types';

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
