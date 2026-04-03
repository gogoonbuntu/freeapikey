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
        // Check existing keys per provider to avoid duplicates
        const existingKeys = await getApiKeys(uid);
        const existingProviders = new Set(existingKeys.map(k => k.provider));

        let seeded = false;
        for (const keyData of DEFAULT_KEYS) {
            // Skip if no key in env or provider already has a key
            if (!keyData.key || existingProviders.has(keyData.provider)) {
                continue;
            }
            const config = PROVIDER_CONFIG[keyData.provider];
            await addApiKey(uid, {
                provider: keyData.provider,
                key: keyData.key,
                label: keyData.label,
                limits: config.defaultLimits,
                isActive: true,
            });
            seeded = true;
        }

        if (seeded) console.log('✅ Initial data seeded for user:', uid);
        return seeded;
    } catch (err) {
        console.error('Failed to seed initial data:', err);
        return false;
    }
}
