'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getApiKeys } from '@/lib/firestore';
import { AIProvider, PROVIDER_CONFIG, ApiKey } from '@/lib/types';
import { Play, Square, RotateCcw, Bot } from 'lucide-react';

interface Message {
    role: 'A' | 'B';
    provider: AIProvider;
    model: string;
    content: string;
    latencyMs: number;
}

const DEBATE_TOPICS = [
    { label: '🤖 AI 의식', prompt: '당신은 AI입니다. AI가 진정한 의식을 가질 수 있다고 생각하나요? 당신의 견해를 밝히고 상대방의 의견에 반응해주세요.' },
    { label: '🧬 인류 미래', prompt: '유전자 편집 기술이 인류의 미래를 어떻게 바꿀까요? 긍정적, 부정적 측면을 포함해 논의해주세요.' },
    { label: '⚡ AGI 위험', prompt: 'AGI(인공일반지능)는 인류에게 위협인가요, 아니면 기회인가요? 상대방과 토론해보세요.' },
    { label: '🌍 기후 우선', prompt: '기후변화 해결을 위해 경제 성장을 희생할 의향이 있나요? 구체적인 논거를 들어 토론해주세요.' },
    { label: '🎨 AI 창의성', prompt: 'AI가 생성한 예술 작품은 진정한 창의성의 산물일까요? 인간의 창의성과 비교해 논의해주세요.' },
    { label: '🏛️ 민주주의', prompt: '디지털 기술의 발전은 민주주의를 강화하나요, 약화하나요? 근거를 들어 토론해주세요.' },
];

export default function AiDebatePage() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [providerA, setProviderA] = useState<AIProvider>('gemini');
    const [modelA, setModelA] = useState('');
    const [providerB, setProviderB] = useState<AIProvider>('groq');
    const [modelB, setModelB] = useState('');
    const [topic, setTopic] = useState('');
    const [maxTurns, setMaxTurns] = useState(6);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [currentTurn, setCurrentTurn] = useState(0);
    const [error, setError] = useState('');
    const stopRef = useRef(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    const loadKeys = useCallback(async () => {
        if (!user) return;
        const keys = await getApiKeys(user.uid);
        setApiKeys(keys);
    }, [user]);

    useEffect(() => { loadKeys(); }, [loadKeys]);

    useEffect(() => {
        setModelA(PROVIDER_CONFIG[providerA].models[0] || '');
    }, [providerA]);

    useEffect(() => {
        setModelB(PROVIDER_CONFIG[providerB].models[0] || '');
    }, [providerB]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const callModel = async (provider: AIProvider, model: string, prompt: string): Promise<{ text: string; latencyMs: number }> => {
        const key = apiKeys.find(k => k.provider === provider && k.isActive);
        if (!key) throw new Error(`${PROVIDER_CONFIG[provider].name} 키가 없습니다`);
        const res = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, key: key.key, model, prompt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'API 오류');
        return { text: data.text, latencyMs: data.latencyMs };
    };

    const handleStart = async () => {
        if (!topic.trim()) return;
        setMessages([]);
        setError('');
        setCurrentTurn(0);
        setIsRunning(true);
        stopRef.current = false;

        let history: Message[] = [];
        const systemPrompt = `당신은 AI 토론 참가자입니다. 상대방의 말에 반응하며 주제에 대해 논리적으로 토론해주세요. 답변은 3-5문장으로 간결하게 해주세요.`;

        try {
            for (let turn = 0; turn < maxTurns; turn++) {
                if (stopRef.current) break;

                const isA = turn % 2 === 0;
                const currentProvider = isA ? providerA : providerB;
                const currentModel = isA ? modelA : modelB;
                const role: 'A' | 'B' = isA ? 'A' : 'B';

                // Build conversation context
                let prompt = systemPrompt + `\n\n주제: ${topic}\n\n`;
                if (history.length === 0) {
                    prompt += `당신이 먼저 이 주제에 대한 의견을 밝혀주세요.`;
                } else {
                    const lastMsg = history[history.length - 1];
                    prompt += `대화 기록:\n`;
                    history.slice(-4).forEach(m => {
                        prompt += `[${m.role === 'A' ? 'AI-A' : 'AI-B'}]: ${m.content}\n\n`;
                    });
                    prompt += `상대방이 말했습니다: "${lastMsg.content}"\n\n당신의 응답:`;
                }

                setCurrentTurn(turn + 1);
                const { text, latencyMs } = await callModel(currentProvider, currentModel, prompt);

                const msg: Message = {
                    role,
                    provider: currentProvider,
                    model: currentModel,
                    content: text,
                    latencyMs,
                };
                history = [...history, msg];
                setMessages(prev => [...prev, msg]);

                // Small pause between turns
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '오류 발생');
        } finally {
            setIsRunning(false);
            stopRef.current = false;
        }
    };

    const handleStop = () => {
        stopRef.current = true;
        setIsRunning(false);
    };

    const handleReset = () => {
        setMessages([]);
        setError('');
        setCurrentTurn(0);
    };

    const configColor = (p: AIProvider) => PROVIDER_CONFIG[p].color;

    return (
        <div>
            <div className="page-header">
                <h2>🤖 AI vs AI 토론</h2>
                <p>두 AI 모델이 주제를 놓고 자동으로 대화합니다</p>
            </div>

            {/* Configuration */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 16 }}>
                    {/* AI-A */}
                    <div style={{ padding: 16, borderRadius: 10, border: `2px solid ${configColor(providerA)}33`, background: `${configColor(providerA)}0a` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: configColor(providerA), marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bot size={14} /> AI-A
                        </div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                            <label>프로바이더</label>
                            <select className="form-select" value={providerA} onChange={e => setProviderA(e.target.value as AIProvider)}>
                                {(['gemini', 'groq', 'cerebras'] as AIProvider[]).map(p => (
                                    <option key={p} value={p}>{PROVIDER_CONFIG[p].name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>모델</label>
                            <select className="form-select" value={modelA} onChange={e => setModelA(e.target.value)}>
                                {PROVIDER_CONFIG[providerA].models.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* AI-B */}
                    <div style={{ padding: 16, borderRadius: 10, border: `2px solid ${configColor(providerB)}33`, background: `${configColor(providerB)}0a` }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: configColor(providerB), marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Bot size={14} /> AI-B
                        </div>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                            <label>프로바이더</label>
                            <select className="form-select" value={providerB} onChange={e => setProviderB(e.target.value as AIProvider)}>
                                {(['gemini', 'groq', 'cerebras'] as AIProvider[]).map(p => (
                                    <option key={p} value={p}>{PROVIDER_CONFIG[p].name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>모델</label>
                            <select className="form-select" value={modelB} onChange={e => setModelB(e.target.value)}>
                                {PROVIDER_CONFIG[providerB].models.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Topic */}
                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>토론 주제</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {DEBATE_TOPICS.map((t, i) => (
                            <button
                                key={i}
                                onClick={() => setTopic(t.prompt)}
                                style={{
                                    fontSize: 11, padding: '4px 10px', borderRadius: 20,
                                    border: '1px solid var(--border-color)',
                                    background: topic === t.prompt ? 'var(--accent-blue)22' : 'var(--bg-secondary)',
                                    color: topic === t.prompt ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                    borderColor: topic === t.prompt ? 'var(--accent-blue)' : 'var(--border-color)',
                                    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                                }}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="form-input"
                        rows={3}
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="토론할 주제를 입력하거나 위에서 선택하세요..."
                        style={{ resize: 'vertical' }}
                    />
                </div>

                {/* Turns + Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>총 발언 횟수</label>
                        <select className="form-select" style={{ width: 80 }} value={maxTurns} onChange={e => setMaxTurns(Number(e.target.value))}>
                            {[2, 4, 6, 8, 10].map(n => <option key={n} value={n}>{n}회</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                        {messages.length > 0 && !isRunning && (
                            <button className="btn btn-secondary" onClick={handleReset}>
                                <RotateCcw size={14} /> 초기화
                            </button>
                        )}
                        {isRunning ? (
                            <button className="btn btn-danger" onClick={handleStop} style={{ background: 'var(--accent-red)', color: '#fff', border: 'none' }}>
                                <Square size={14} /> 중지
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleStart}
                                disabled={!topic.trim()}
                            >
                                <Play size={14} /> 토론 시작
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress */}
            {isRunning && (
                <div className="card animate-in" style={{ marginBottom: 16, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="spinner" />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {currentTurn}/{maxTurns} 번째 발언 생성 중...
                    </span>
                    <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${(currentTurn / maxTurns) * 100}%`,
                            background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                            transition: 'width 0.3s ease',
                            borderRadius: 4,
                        }} />
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="card animate-in" style={{ marginBottom: 16, borderColor: 'rgba(239,68,68,0.3)', padding: 14, color: 'var(--accent-red)', fontSize: 13 }}>
                    ❌ {error}
                </div>
            )}

            {/* Chat */}
            {messages.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: 13, fontWeight: 600, display: 'flex', gap: 16 }}>
                        <span style={{ color: configColor(providerA) }}>● AI-A: {PROVIDER_CONFIG[providerA].name} / {modelA}</span>
                        <span style={{ color: configColor(providerB) }}>● AI-B: {PROVIDER_CONFIG[providerB].name} / {modelB}</span>
                    </div>
                    <div style={{ maxHeight: 520, overflowY: 'auto', padding: '16px' }}>
                        {messages.map((msg, i) => {
                            const isA = msg.role === 'A';
                            const color = configColor(msg.provider);
                            return (
                                <div key={i} className="animate-in" style={{
                                    display: 'flex',
                                    flexDirection: isA ? 'row' : 'row-reverse',
                                    gap: 10,
                                    marginBottom: 16,
                                    alignItems: 'flex-start',
                                }}>
                                    {/* Avatar */}
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: `${color}22`,
                                        border: `2px solid ${color}44`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 12, fontWeight: 700, color,
                                        flexShrink: 0,
                                    }}>
                                        {msg.role}
                                    </div>

                                    {/* Bubble */}
                                    <div style={{ maxWidth: '75%' }}>
                                        <div style={{
                                            fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4,
                                            textAlign: isA ? 'left' : 'right',
                                        }}>
                                            {PROVIDER_CONFIG[msg.provider].name} · {msg.model} · {msg.latencyMs}ms
                                        </div>
                                        <div style={{
                                            background: isA ? `${color}15` : 'var(--bg-secondary)',
                                            border: `1px solid ${isA ? color + '30' : 'var(--border-color)'}`,
                                            borderRadius: isA ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                                            padding: '10px 14px',
                                            fontSize: 14,
                                            lineHeight: 1.6,
                                            color: 'var(--text-primary)',
                                        }}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {isRunning && (
                            <div style={{ display: 'flex', justifyContent: currentTurn % 2 === 0 ? 'flex-start' : 'flex-end', padding: '4px 46px' }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: 'var(--accent-blue)',
                                            animation: `bounce 1.2s ${i * 0.2}s infinite`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                </div>
            )}

            {/* Empty state */}
            {messages.length === 0 && !isRunning && (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🤖💬🤖</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>AI 토론을 시작해보세요</div>
                    <div style={{ fontSize: 13 }}>주제를 선택하고 토론 시작 버튼을 누르면<br />두 AI가 자동으로 대화를 이어갑니다</div>
                </div>
            )}

            <style>{`
                @keyframes bounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
                    40% { transform: translateY(-6px); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
