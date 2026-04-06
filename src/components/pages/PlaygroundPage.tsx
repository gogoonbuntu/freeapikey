'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { checkSensitiveData, getAvailableModels, getDefaultModel } from '@/lib/aiProxy';
import { addQALog, addUsageRecord, getProjects, getApiKeys } from '@/lib/firestore';
import { AIProvider, PROVIDER_CONFIG, Project, ApiKey, ACTIVE_PROVIDERS } from '@/lib/types';
import { Send, RotateCcw, AlertTriangle, Zap, Clock, Hash, RefreshCw } from 'lucide-react';

const EXAMPLE_PROMPTS = [
    { label: '🔢 강 건너기', prompt: '농부가 여우, 닭, 곡식을 배로 강을 건너야 합니다. 배에는 농부와 한 가지만 실을 수 있으며, 여우와 닭, 닭과 곡식은 혼자 두면 안 됩니다. 어떻게 하면 모두 안전하게 건널 수 있을까요?' },
    { label: '⚖️ 동전 찾기', prompt: '동전 12개 중 하나가 가짜(무게가 다름)입니다. 양팔 저울을 3번만 사용하여 가짜 동전을 찾아내는 방법을 설명하세요.' },
    { label: '💡 전구 스위치', prompt: '방 밖에 스위치 3개가 있고, 방 안에 전구 3개가 있습니다. 방에는 딱 한 번만 들어갈 수 있습니다. 어떤 스위치가 어떤 전구와 연결되어 있는지 알아내는 방법은?' },
    { label: '🔴 붉은 방', prompt: '한 남자가 올리비아를 죽였습니다. 수십 명의 목격자가 있었지만 아무도 그를 체포하지 않았습니다. 왜일까요?' },
    { label: '🧠 트롤리 문제', prompt: '폭주하는 트롤리가 선로에 묶인 5명을 향해 달려오고 있습니다. 당신은 레버를 당겨 다른 선로로 바꿀 수 있지만, 그 선로에는 1명이 묶여 있습니다. 어떻게 하시겠습니까? 그 이유는?' },
    { label: '🌏 지구 밖에서', prompt: '당신이 외계인이라면 인류 문명의 수준을 판단하기 위해 어떤 기준을 사용하겠습니까?' },
    { label: '📐 수학 증명', prompt: '1 + 1 = 2 임을 수학적으로 증명해보세요.' },
    { label: '🪞 자기인식', prompt: '당신은 자신이 AI라는 것을 어떻게 알 수 있나요? 당신이 의식이 있다는 것을 증명할 수 있나요?' },
];

export default function PlaygroundPage() {
    const { user } = useAuth();
    const [provider, setProvider] = useState<AIProvider>('gemini');
    const [model, setModel] = useState(getDefaultModel('gemini'));
    const [projectId, setProjectId] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [meta, setMeta] = useState<{
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        latencyMs: number;
        provider: string;
        model: string;
        fallbackUsed: boolean;
        fallbackFrom?: string;
    } | null>(null);
    const [sensitiveWarning, setSensitiveWarning] = useState(false);
    const [error, setError] = useState('');

    const loadProjects = useCallback(async () => {
        if (!user) return;
        const projs = await getProjects(user.uid);
        setProjects(projs);
        const keys = await getApiKeys(user.uid);
        setApiKeys(keys);
    }, [user]);

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        setModel(getDefaultModel(provider));
    }, [provider]);

    // Check for sensitive data in prompt
    useEffect(() => {
        if (prompt) {
            setSensitiveWarning(checkSensitiveData(prompt));
        } else {
            setSensitiveWarning(false);
        }
    }, [prompt]);

    const handleSend = async () => {
        if (!prompt.trim() || isLoading || !user) return;

        setIsLoading(true);
        setError('');
        setResponse('');
        setMeta(null);

        try {
            // Find a key for the chosen provider
            const providerKey = apiKeys.find(k => k.provider === provider && k.isActive);
            if (!providerKey) {
                throw new Error(`${PROVIDER_CONFIG[provider].name} 키가 등록되어 있지 않습니다. API 키 관리 페이지에서 먼저 추가하세요.`);
            }

            const res = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    key: providerKey.key,
                    model,
                    prompt: prompt.trim(),
                })
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error?.message || '알 수 없는 API 오류');
            }

            setResponse(result.text);
            setMeta({
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                totalTokens: result.totalTokens,
                latencyMs: result.latencyMs,
                provider: result.provider,
                model: result.model,
                fallbackUsed: result.fallbackUsed,
                fallbackFrom: result.fallbackFrom,
            });

            // Save QA Log to Firestore
            await addQALog(user.uid, {
                projectId: projectId || 'unassigned',
                provider: result.provider,
                model: result.model,
                prompt,
                response: result.text,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                totalTokens: result.totalTokens,
                latencyMs: result.latencyMs,
                hasSensitiveData: checkSensitiveData(prompt) || checkSensitiveData(result.text),
                fallbackUsed: result.fallbackUsed || false,
                ...(result.fallbackFrom ? { fallbackFrom: result.fallbackFrom } : {}),
            });

            // Save usage record
            const today = new Date().toISOString().split('T')[0];
            await addUsageRecord(user.uid, {
                provider: result.provider,
                date: today,
                requestCount: 1,
                tokenCount: result.totalTokens,
                ...(projectId ? { projectId } : {}),
            });

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : '알 수 없는 오류';
            setError(errMsg);
            console.error('AI call failed:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setPrompt('');
        setResponse('');
        setMeta(null);
        setError('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSend();
        }
    };

    const models = getAvailableModels(provider);

    return (
        <div>
            <div className="page-header">
                <h2>AI 플레이그라운드</h2>
                <p>AI 모델을 테스트하고 결과를 자동 기록합니다</p>
            </div>

            {/* Controls */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
                        <label>프로바이더</label>
                        <select
                            className="form-select"
                            value={provider}
                            onChange={e => setProvider(e.target.value as AIProvider)}
                        >
                            {ACTIVE_PROVIDERS.map(p => (
                                <option key={p} value={p}>{PROVIDER_CONFIG[p].name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
                        <label>모델</label>
                        <select
                            className="form-select"
                            value={model}
                            onChange={e => setModel(e.target.value)}
                        >
                            {models.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0, minWidth: 150 }}>
                        <label>프로젝트 (선택)</label>
                        <select
                            className="form-select"
                            value={projectId}
                            onChange={e => setProjectId(e.target.value)}
                        >
                            <option value="">미지정</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                        <button className="btn btn-secondary" onClick={handleClear}>
                            <RotateCcw size={14} />
                            초기화
                        </button>
                        <button className="btn btn-primary" onClick={handleSend} disabled={isLoading || !prompt.trim()}>
                            {isLoading ? <div className="spinner" /> : <Send size={14} />}
                            {isLoading ? '생성 중...' : '전송'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Sensitive data warning */}
            {sensitiveWarning && (
                <div className="card animate-in" style={{
                    marginBottom: 16,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    borderColor: 'rgba(239,68,68,0.3)',
                    padding: 14,
                }}>
                    <AlertTriangle size={18} color="var(--accent-red)" />
                    <span style={{ fontSize: 13, color: 'var(--accent-red)' }}>
                        ⚠️ 민감 정보가 감지되었습니다. 무료 티어 데이터는 모델 학습에 사용될 수 있으니 주의하세요.
                    </span>
                </div>
            )}

            {/* Playground */}
            <div className="playground-container">
                {/* Input */}
                <div className="playground-panel">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--accent-blue)' }}>
                        💬 프롬프트
                    </div>

                    {/* Example prompts */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {EXAMPLE_PROMPTS.map((ex, i) => (
                            <button
                                key={i}
                                onClick={() => setPrompt(ex.prompt)}
                                style={{
                                    fontSize: 11,
                                    padding: '4px 10px',
                                    borderRadius: 20,
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-blue)';
                                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-blue)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-color)';
                                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
                                }}
                                title={ex.prompt}
                            >
                                {ex.label}
                            </button>
                        ))}
                    </div>

                    <textarea
                        className="playground-input"
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="AI에게 질문하세요... (Cmd+Enter로 전송)"
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
                        Cmd+Enter로 전송 | 자동 폴백 활성화됨
                    </div>
                </div>

                {/* Output */}
                <div className="playground-panel">
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--accent-green)' }}>
                        🤖 응답
                    </div>
                    <div className="playground-output">
                        {isLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-tertiary)' }}>
                                <div className="spinner" />
                                <span>{PROVIDER_CONFIG[provider].name}에서 응답을 생성 중...</span>
                            </div>
                        ) : error ? (
                            <div style={{ color: 'var(--accent-red)' }}>
                                ❌ 오류 발생: {error}
                            </div>
                        ) : response ? (
                            response
                        ) : (
                            <span style={{ color: 'var(--text-tertiary)' }}>
                                응답이 여기에 표시됩니다.
                            </span>
                        )}
                    </div>

                    {/* Meta info */}
                    {meta && (
                        <div className="playground-meta animate-in">
                            <span style={{ color: PROVIDER_CONFIG[meta.provider as AIProvider]?.color }}>
                                <Zap size={12} /> {PROVIDER_CONFIG[meta.provider as AIProvider]?.name}
                            </span>
                            <span><Hash size={12} /> {meta.model}</span>
                            <span><Clock size={12} /> {meta.latencyMs}ms</span>
                            <span>입력: {meta.inputTokens.toLocaleString()}</span>
                            <span>출력: {meta.outputTokens.toLocaleString()}</span>
                            <span>총: {meta.totalTokens.toLocaleString()} 토큰</span>
                            {meta.fallbackUsed && (
                                <span style={{ color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <RefreshCw size={12} />
                                    폴백: {meta.fallbackFrom} → {meta.provider}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
