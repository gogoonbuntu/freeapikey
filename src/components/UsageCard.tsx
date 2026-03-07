'use client';

import React from 'react';
import { AIProvider, PROVIDER_CONFIG, QuotaStatus } from '@/lib/types';

interface UsageCardProps {
    provider: AIProvider;
    currentRequests: number;
    currentTokens: number;
    maxRequests?: number;
    maxTokens?: number;
    status: 'normal' | 'warning' | 'exceeded';
    // Quota props
    remainingRequests?: number;
    remainingTokens?: number;
    limitRequests?: number;
    limitTokens?: number;
    quotaCheckedAt?: Date;
    quotaIsValid?: boolean;
}

export default function UsageCard({
    provider,
    currentRequests,
    currentTokens,
    maxRequests = 0,
    maxTokens = 0,
    status,
    remainingRequests,
    remainingTokens,
    limitRequests,
    limitTokens,
    quotaCheckedAt,
    quotaIsValid,
}: UsageCardProps) {
    const config = PROVIDER_CONFIG[provider];

    // Use real quota data if available, otherwise use tracked usage
    const hasQuotaData = remainingRequests !== undefined || remainingTokens !== undefined;

    const requestPercent = (() => {
        if (remainingRequests !== undefined && limitRequests) {
            return Math.min(((limitRequests - remainingRequests) / limitRequests) * 100, 100);
        }
        return maxRequests > 0 ? Math.min((currentRequests / maxRequests) * 100, 100) : 0;
    })();

    const tokenPercent = (() => {
        if (remainingTokens !== undefined && limitTokens) {
            return Math.min(((limitTokens - remainingTokens) / limitTokens) * 100, 100);
        }
        return maxTokens > 0 ? Math.min((currentTokens / maxTokens) * 100, 100) : 0;
    })();

    const statusLabels = {
        normal: '정상',
        warning: '주의',
        exceeded: '초과',
    };

    const formatNumber = (n: number) => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toLocaleString();
    };

    return (
        <div className="card animate-in" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Top gradient accent */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: config.gradient,
                }}
            />

            <div className="card-header" style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-md)',
                            background: `${config.color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            color: config.color,
                        }}
                    >
                        {config.name.charAt(0)}
                    </div>
                    <div>
                        <div className="card-title">{config.name}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={`status-badge status-${status}`}>
                        <span className="status-dot" />
                        {statusLabels[status]}
                    </span>
                    {quotaIsValid !== undefined && (
                        <span style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: quotaIsValid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: quotaIsValid ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}>
                            {quotaIsValid ? '키 유효' : '키 무효'}
                        </span>
                    )}
                </div>
            </div>

            {/* Real-time Quota Section */}
            {hasQuotaData && (
                <div style={{
                    padding: '10px 12px',
                    marginBottom: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59,130,246,0.04)',
                    border: '1px solid rgba(59,130,246,0.08)',
                }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8, fontWeight: 600 }}>
                        📡 실시간 잔여 할당량
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        {remainingRequests !== undefined && (
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: config.color }}>
                                    {formatNumber(remainingRequests)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                    잔여 요청{limitRequests ? ` / ${formatNumber(limitRequests)}` : ''}
                                </div>
                            </div>
                        )}
                        {remainingTokens !== undefined && (
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: config.color }}>
                                    {formatNumber(remainingTokens)}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                                    잔여 토큰{limitTokens ? ` / ${formatNumber(limitTokens)}` : ''}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Requests progress */}
            {(maxRequests > 0 || (limitRequests && limitRequests > 0)) && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>요청 (일일)</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {remainingRequests !== undefined && limitRequests
                                ? `${formatNumber(limitRequests - remainingRequests)} / ${formatNumber(limitRequests)}`
                                : `${currentRequests.toLocaleString()} / ${maxRequests.toLocaleString()}`
                            }
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{
                                width: `${requestPercent}%`,
                                background: requestPercent >= 90 ? 'var(--accent-red)' : requestPercent >= 70 ? 'var(--accent-yellow)' : config.color,
                                transition: 'width 0.6s ease',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Tokens progress */}
            {(maxTokens > 0 || (limitTokens && limitTokens > 0)) && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>토큰 (일일)</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {remainingTokens !== undefined && limitTokens
                                ? `${formatNumber(limitTokens - remainingTokens)} / ${formatNumber(limitTokens)}`
                                : `${currentTokens.toLocaleString()} / ${maxTokens.toLocaleString()}`
                            }
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{
                                width: `${tokenPercent}%`,
                                background: tokenPercent >= 90 ? 'var(--accent-red)' : tokenPercent >= 70 ? 'var(--accent-yellow)' : config.color,
                                transition: 'width 0.6s ease',
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Last checked timestamp */}
            {quotaCheckedAt && (
                <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right' }}>
                    마지막 체크: {quotaCheckedAt.toLocaleTimeString('ko-KR')}
                </div>
            )}
        </div>
    );
}
