import { getApiKeys, addApiKey } from './firestore';
import { AIProvider, PROVIDER_CONFIG } from './types';

const DEFAULT_KEYS: Array<{
    provider: AIProvider;
    key: string;
    label: string;
}> = [
        {
            provider: 'gemini',
            key: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
            label: 'Gemini API Key',
        },
        {
            provider: 'groq',
            key: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',
            label: 'Groq API Key',
        },
        {
            provider: 'cerebras',
            key: process.env.NEXT_PUBLIC_CEREBRAS_API_KEY || '',
            label: 'Cerebras API Key',
        },
    ];

export async function seedInitialData(uid: string): Promise<boolean> {
    try {
        // Check if user already has keys
        const existingKeys = await getApiKeys(uid);
        if (existingKeys.length > 0) {
            return false; // Already seeded
        }

        // Add default API keys
        for (const keyData of DEFAULT_KEYS) {
            const config = PROVIDER_CONFIG[keyData.provider];
            await addApiKey(uid, {
                provider: keyData.provider,
                key: keyData.key,
                label: keyData.label,
                limits: config.defaultLimits,
                isActive: true,
            });
        }

        console.log('✅ Initial data seeded for user:', uid);
        return true;
    } catch (err) {
        console.error('Failed to seed initial data:', err);
        return false;
    }
}
