'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { smartAICall, checkSensitiveData, getAvailableModels, getDefaultModel } from '@/lib/aiProxy';
import { addQALog, addUsageRecord, getProjects } from '@/lib/firestore';
import { AIProvider, PROVIDER_CONFIG, Project } from '@/lib/types';
import { Send, RotateCcw, AlertTriangle, Zap, Clock, Hash, RefreshCw } from 'lucide-react';

export default function PlaygroundPage() {
    const { user } = useAuth();
    const [provider, setProvider] = useState<AIProvider>('gemini');
    const [model, setModel] = useState(getDefaultModel('gemini'));
    const [projectId, setProjectId] = useState('');
    const [projects, setProjects] = useState<Project[]>([]);
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
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
            const result = await smartAICall({
                prompt,
                provider,
                model,
                projectId,
            });

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
                fallbackUsed: result.fallbackUsed,
                fallbackFrom: result.fallbackFrom,
            });

            // Save usage record
            const today = new Date().toISOString().split('T')[0];
            await addUsageRecord(user.uid, {
                provider: result.provider,
                date: today,
                requestCount: 1,
                tokenCount: result.totalTokens,
                projectId: projectId || undefined,
            });

        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error occurred';
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
                            {(['gemini', 'groq', 'cerebras'] as AIProvider[]).map(p => (
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
