'use client';

import React from 'react';
import { AIProvider, PROVIDER_CONFIG } from '@/lib/types';

interface UsageCardProps {
    provider: AIProvider;
    currentRequests: number;
    currentTokens: number;
    maxRequests?: number;
    maxTokens?: number;
    status: 'normal' | 'warning' | 'exceeded';
}

export default function UsageCard({
    provider,
    currentRequests,
    currentTokens,
    maxRequests = 0,
    maxTokens = 0,
    status,
}: UsageCardProps) {
    const config = PROVIDER_CONFIG[provider];

    const requestPercent = maxRequests > 0 ? Math.min((currentRequests / maxRequests) * 100, 100) : 0;
    const tokenPercent = maxTokens > 0 ? Math.min((currentTokens / maxTokens) * 100, 100) : 0;

    const statusLabels = {
        normal: '정상',
        warning: '주의',
        exceeded: '초과',
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
                <span className={`status-badge status-${status}`}>
                    <span className="status-dot" />
                    {statusLabels[status]}
                </span>
            </div>

            {/* Requests */}
            {maxRequests > 0 && (
                <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>요청 (일일)</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {currentRequests.toLocaleString()} / {maxRequests.toLocaleString()}
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{
                                width: `${requestPercent}%`,
                                background: requestPercent >= 90 ? 'var(--accent-red)' : requestPercent >= 70 ? 'var(--accent-yellow)' : config.color,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Tokens */}
            {maxTokens > 0 && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>토큰 (일일)</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {currentTokens.toLocaleString()} / {maxTokens.toLocaleString()}
                        </span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-bar-fill"
                            style={{
                                width: `${tokenPercent}%`,
                                background: tokenPercent >= 90 ? 'var(--accent-red)' : tokenPercent >= 70 ? 'var(--accent-yellow)' : config.color,
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
