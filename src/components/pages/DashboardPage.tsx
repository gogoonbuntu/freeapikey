'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getApiKeys, getTodayUsage, getQALogs } from '@/lib/firestore';
import { ApiKey, QALog, PROVIDER_CONFIG, AIProvider } from '@/lib/types';
import { useQuotaChecker } from '@/lib/useQuotaChecker';
import UsageCard from '@/components/UsageCard';
import GaugeChart from '@/components/GaugeChart';
import { Activity, Zap, Clock, TrendingUp, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [usage, setUsage] = useState<Record<AIProvider, { requests: number; tokens: number }>>({
        gemini: { requests: 0, tokens: 0 },
        groq: { requests: 0, tokens: 0 },
        cerebras: { requests: 0, tokens: 0 },
        custom: { requests: 0, tokens: 0 },
    });
    const [recentLogs, setRecentLogs] = useState<QALog[]>([]);
    const [loading, setLoading] = useState(true);

    const { quotaMap, isChecking, lastCheckedAt, checkNow, nextCheckIn } = useQuotaChecker(
        user?.uid || null,
        apiKeys
    );

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const [keysResult, usageResult, logsResult] = await Promise.allSettled([
                getApiKeys(user.uid),
                getTodayUsage(user.uid),
                getQALogs(user.uid, { limitCount: 5 }),
            ]);
            if (keysResult.status === 'fulfilled') setApiKeys(keysResult.value);
            else console.warn('Failed to load API keys:', keysResult.reason);

            if (usageResult.status === 'fulfilled') setUsage(usageResult.value);
            else console.warn('Failed to load usage:', usageResult.reason);

            if (logsResult.status === 'fulfilled') setRecentLogs(logsResult.value);
            else console.warn('Failed to load QA logs:', logsResult.reason);
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getProviderLimits = (provider: AIProvider) => {
        const defaults = PROVIDER_CONFIG[provider].defaultLimits;
        const key = apiKeys.find(k => k.provider === provider);
        if (key) {
            // Merge: use key limits if set, otherwise fall back to defaults
            return {
                rpm: key.limits.rpm || defaults.rpm,
                rpd: key.limits.rpd || defaults.rpd,
                tpm: key.limits.tpm || defaults.tpm,
                tpd: key.limits.tpd || defaults.tpd,
                dailyTokenLimit: key.limits.dailyTokenLimit || defaults.dailyTokenLimit,
            };
        }
        return defaults;
    };

    const getProviderQuota = (provider: AIProvider) => {
        const key = apiKeys.find(k => k.provider === provider);
        if (key && quotaMap[key.id]) {
            return quotaMap[key.id];
        }
        return null;
    };

    const getStatus = (provider: AIProvider): 'normal' | 'warning' | 'exceeded' => {
        const quota = getProviderQuota(provider);
        // Check quotaExhausted flag (e.g. Gemini where all models are exhausted)
        if (quota && (quota as any).quotaExhausted === true) return 'exceeded';
        if (quota && quota.remainingRequests !== undefined && quota.limitRequests) {
            const usedPct = 1 - (quota.remainingRequests / quota.limitRequests);
            if (usedPct >= 1) return 'exceeded';
            if (usedPct >= 0.7) return 'warning';
            return 'normal';
        }
        // If we have quota data and it's valid, but no remaining info (e.g. Gemini success), assume normal
        if (quota && quota.isValid && (quota as any).quotaExhausted === false) return 'normal';
        // Fallback to usage-based estimation
        const limits = getProviderLimits(provider);
        const u = usage[provider];
        const rpd = limits.rpd || limits.dailyTokenLimit || 0;
        const current = limits.rpd ? u.requests : u.tokens;
        if (rpd === 0) return 'normal';
        const pct = current / rpd;
        if (pct >= 1) return 'exceeded';
        if (pct >= 0.7) return 'warning';
        return 'normal';
    };

    const totalRequests = Object.values(usage).reduce((sum, u) => sum + u.requests, 0);
    const totalTokens = Object.values(usage).reduce((sum, u) => sum + u.tokens, 0);

    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div>
                <div className="page-header">
                    <h2>대시보드</h2>
                    <p>AI API 사용 현황 종합 모니터링</p>
                </div>
                <div className="grid-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card">
                            <div className="skeleton" style={{ height: 120 }} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h2>대시보드</h2>
                    <p>AI API 사용 현황 종합 모니터링</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                        {lastCheckedAt && (
                            <div>마지막 체크: {lastCheckedAt.toLocaleTimeString('ko-KR')}</div>
                        )}
                        <div>다음 체크: {formatCountdown(nextCheckIn)}</div>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={checkNow}
                        disabled={isChecking}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
                    >
                        <RefreshCw size={14} className={isChecking ? 'spinning' : ''} style={isChecking ? { animation: 'spin 1s linear infinite' } : {}} />
                        {isChecking ? '확인 중...' : '할당량 체크'}
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
                <div className="card animate-in" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(59,130,246,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Activity size={20} color="var(--accent-blue)" />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>오늘 총 요청</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{totalRequests.toLocaleString()}</div>
                    </div>
                </div>

                <div className="card animate-in" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(16,185,129,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Zap size={20} color="var(--accent-green)" />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>오늘 토큰 사용</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{totalTokens.toLocaleString()}</div>
                    </div>
                </div>

                <div className="card animate-in" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(139,92,246,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Key size={20} color="var(--accent-purple)" />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>등록된 키</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{apiKeys.length}</div>
                    </div>
                </div>

                <div className="card animate-in" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(245,158,11,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <TrendingUp size={20} color="var(--accent-yellow)" />
                    </div>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 2 }}>QA 기록</div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>{recentLogs.length}</div>
                    </div>
                </div>
            </div>

            {/* Provider Usage Cards */}
            <div className="grid-3" style={{ marginBottom: 24 }}>
                {(['gemini', 'groq', 'cerebras'] as AIProvider[]).map(provider => {
                    const limits = getProviderLimits(provider);
                    const quota = getProviderQuota(provider);
                    // Use real quota limits when available, otherwise fallback to config defaults
                    const effectiveMaxReqs = quota?.limitRequests || limits.rpd || 0;
                    const effectiveMaxTokens = quota?.limitTokens || limits.tpd || limits.dailyTokenLimit || 0;
                    return (
                        <UsageCard
                            key={provider}
                            provider={provider}
                            currentRequests={usage[provider].requests}
                            currentTokens={usage[provider].tokens}
                            maxRequests={effectiveMaxReqs}
                            maxTokens={effectiveMaxTokens}
                            status={getStatus(provider)}
                            remainingRequests={quota?.remainingRequests}
                            remainingTokens={quota?.remainingTokens}
                            limitRequests={quota?.limitRequests}
                            limitTokens={quota?.limitTokens}
                            quotaCheckedAt={quota?.checkedAt}
                            quotaIsValid={quota?.isValid}
                            quotaExhausted={(quota as any)?.quotaExhausted}
                            perModelQuota={(quota as any)?.perModelQuota}
                        />
                    );
                })}
            </div>

            {/* Gauge Charts */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <h3 className="card-title">실시간 크레딧 잔량</h3>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 20, padding: '12px 0' }}>
                    {(['gemini', 'groq', 'cerebras'] as AIProvider[]).map(provider => {
                        const quota = getProviderQuota(provider);
                        const limits = getProviderLimits(provider);
                        // Use real remaining data if available
                        const maxVal = quota?.limitRequests || limits.rpd || 0;
                        const usedVal = quota?.remainingRequests !== undefined
                            ? (quota.limitRequests || maxVal) - quota.remainingRequests
                            : usage[provider].requests;
                        return (
                            <GaugeChart
                                key={`req-${provider}`}
                                value={usedVal}
                                max={maxVal}
                                label={`${PROVIDER_CONFIG[provider].name} 요청`}
                                color={PROVIDER_CONFIG[provider].color}
                            />
                        );
                    })}
                    {(['gemini', 'groq', 'cerebras'] as AIProvider[]).map(provider => {
                        const quota = getProviderQuota(provider);
                        const limits = getProviderLimits(provider);
                        const tokenLimit = quota?.limitTokens || limits.tpd || limits.dailyTokenLimit || 0;
                        const usedTokens = quota?.remainingTokens !== undefined
                            ? (quota.limitTokens || tokenLimit) - quota.remainingTokens
                            : usage[provider].tokens;
                        return (
                            <GaugeChart
                                key={`tok-${provider}`}
                                value={usedTokens}
                                max={tokenLimit}
                                label={`${PROVIDER_CONFIG[provider].name} 토큰`}
                                color={PROVIDER_CONFIG[provider].color}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Recent QA Logs */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">최근 QA 기록</h3>
                </div>
                {recentLogs.length === 0 ? (
                    <div className="empty-state">
                        <MessageSquareText size={40} />
                        <h3>아직 QA 기록이 없습니다</h3>
                        <p>플레이그라운드에서 AI 모델을 테스트하면 자동으로 기록됩니다.</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>프로바이더</th>
                                    <th>모델</th>
                                    <th>프롬프트</th>
                                    <th>토큰</th>
                                    <th>응답시간</th>
                                    <th>일시</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentLogs.map(log => (
                                    <tr key={log.id}>
                                        <td>
                                            <span className={`tag tag-${log.provider === 'gemini' ? 'blue' : log.provider === 'groq' ? 'red' : 'purple'}`}>
                                                {PROVIDER_CONFIG[log.provider]?.name || log.provider}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13 }}>{log.model}</td>
                                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.prompt}
                                        </td>
                                        <td>{log.totalTokens.toLocaleString()}</td>
                                        <td>{log.latencyMs}ms</td>
                                        <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            {log.createdAt.toLocaleString('ko-KR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Key({ size, color }: { size: number; color: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
        </svg>
    );
}

function MessageSquareText({ size }: { size: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="M13 8H7" /><path d="M17 12H7" />
        </svg>
    );
}
