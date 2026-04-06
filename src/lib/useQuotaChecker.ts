'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiKey, QuotaStatus } from './types';
import { updateApiKeyQuota } from './firestore';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface QuotaCheckResult {
    quotaMap: Record<string, QuotaStatus>;
    isChecking: boolean;
    lastCheckedAt: Date | null;
    error: string | null;
    checkNow: () => Promise<void>;
    checkSingleKey: (key: ApiKey) => Promise<void>;
    nextCheckIn: number; // seconds until next auto-check
}

async function fetchQuota(provider: string, apiKey: string): Promise<QuotaStatus & {
    perModelQuota?: Record<string, any>;
    quotaExhausted?: boolean;
}> {
    try {
        const res = await fetch('/api/quota', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, apiKey }),
        });

        if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        return {
            remainingRequests: data.remainingRequests,
            remainingTokens: data.remainingTokens,
            limitRequests: data.limitRequests,
            limitTokens: data.limitTokens,
            isValid: data.isValid,
            checkedAt: new Date(data.checkedAt),
            error: data.error,
            perModelQuota: data.perModelQuota,
            quotaExhausted: data.quotaExhausted,
        };
    } catch (err) {
        return {
            isValid: false,
            checkedAt: new Date(),
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

export function useQuotaChecker(uid: string | null, apiKeys: ApiKey[]): QuotaCheckResult {
    const [quotaMap, setQuotaMap] = useState<Record<string, QuotaStatus>>({});
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [nextCheckIn, setNextCheckIn] = useState(POLL_INTERVAL_MS / 1000);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Initialize from existing quotaStatus in keys
    useEffect(() => {
        const initial: Record<string, QuotaStatus> = {};
        apiKeys.forEach(key => {
            if (key.quotaStatus) {
                initial[key.id] = key.quotaStatus;
            }
        });
        if (Object.keys(initial).length > 0) {
            setQuotaMap(prev => ({ ...prev, ...initial }));
        }
    }, [apiKeys]);

    const checkAllKeys = useCallback(async () => {
        if (!uid || apiKeys.length === 0) return;

        const activeKeys = apiKeys.filter(k => k.isActive && k.provider !== 'custom');
        if (activeKeys.length === 0) return;

        setIsChecking(true);
        setError(null);

        try {
            const results = await Promise.allSettled(
                activeKeys.map(async (key) => {
                    const status = await fetchQuota(key.provider, key.key);

                    // Persist to Firestore
                    try {
                        await updateApiKeyQuota(uid, key.id, status);
                    } catch (e) {
                        console.warn(`Failed to persist quota for ${key.id}:`, e);
                    }

                    return { keyId: key.id, status };
                })
            );

            const newMap: Record<string, QuotaStatus> = {};
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    newMap[result.value.keyId] = result.value.status;
                }
            });

            setQuotaMap(prev => ({ ...prev, ...newMap }));
            setLastCheckedAt(new Date());
            setNextCheckIn(POLL_INTERVAL_MS / 1000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Quota check failed');
        } finally {
            setIsChecking(false);
        }
    }, [uid, apiKeys]);

    const checkSingleKey = useCallback(async (key: ApiKey) => {
        if (!uid) return;

        setIsChecking(true);
        try {
            const status = await fetchQuota(key.provider, key.key);
            await updateApiKeyQuota(uid, key.id, status);
            setQuotaMap(prev => ({ ...prev, [key.id]: status }));
        } catch (err) {
            console.error('Single key check failed:', err);
        } finally {
            setIsChecking(false);
        }
    }, [uid]);

    // Auto-check on mount + periodic interval
    useEffect(() => {
        if (!uid || apiKeys.length === 0) return;

        // Initial check
        checkAllKeys();

        // Set up polling
        intervalRef.current = setInterval(checkAllKeys, POLL_INTERVAL_MS);

        // Countdown timer
        countdownRef.current = setInterval(() => {
            setNextCheckIn(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [uid, apiKeys.length, checkAllKeys]);

    return {
        quotaMap,
        isChecking,
        lastCheckedAt,
        error,
        checkNow: checkAllKeys,
        checkSingleKey,
        nextCheckIn,
    };
}
