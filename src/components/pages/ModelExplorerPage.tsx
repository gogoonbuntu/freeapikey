'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getApiKeys } from '@/lib/firestore';
import { AIProvider, PROVIDER_CONFIG, ApiKey, ACTIVE_PROVIDERS } from '@/lib/types';
import { Zap, Clock, Hash, Send, Sparkles, Code, Eye, MessageSquare, Brain, Globe, Cpu, Star } from 'lucide-react';

// ===== Model catalog with descriptions =====
interface ModelInfo {
    id: string;
    provider: AIProvider;
    name: string;
    tagline: string;
    strengths: string[];
    icon: React.ReactNode;
    category: string;
    contextLength: string;
    testPrompt: string;
}

const MODEL_CATALOG: ModelInfo[] = [
    // --- Groq ---
    {
        id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B',
        tagline: '메타의 범용 대형 모델 — 빠른 추론 속도',
        strengths: ['빠른 응답 속도 (Groq 하드웨어)', '범용 추론/대화', '70B 파라미터'],
        icon: <Brain size={20} />, category: '범용', contextLength: '128K',
        testPrompt: '양자 컴퓨팅이 기존 암호화 체계에 미치는 위협과 대응 방안을 3가지로 정리해주세요.',
    },
    {
        id: 'llama-3.1-8b-instant', provider: 'groq', name: 'Llama 3.1 8B',
        tagline: '초고속 경량 모델 — 가장 낮은 지연시간',
        strengths: ['극한의 속도 (<100ms)', '간단한 작업에 최적', '높은 RPD (14,400)'],
        icon: <Zap size={20} />, category: '속도', contextLength: '128K',
        testPrompt: '파이썬에서 피보나치 수열을 메모이제이션으로 구현하는 코드를 작성해주세요.',
    },
    {
        id: 'gemma2-9b-it', provider: 'groq', name: 'Gemma 2 9B',
        tagline: 'Google의 오픈소스 경량 모델',
        strengths: ['Google 아키텍처', '높은 토큰 처리량 (15K TPM)', '효율적인 크기 대비 성능'],
        icon: <Star size={20} />, category: '효율', contextLength: '8K',
        testPrompt: '한국어로 하이쿠(5-7-5) 3수를 봄을 주제로 작성해주세요.',
    },

    // --- Cerebras ---
    {
        id: 'llama3.1-8b', provider: 'cerebras', name: 'Llama 3.1 8B (Cerebras)',
        tagline: '웨이퍼 스케일 칩 — 세계 최고 추론 속도',
        strengths: ['2000+ tok/s 출력 속도', '1M 일일 토큰', '실시간 스트리밍 체감'],
        icon: <Cpu size={20} />, category: '속도', contextLength: '8K',
        testPrompt: 'REST API와 GraphQL의 차이를 표로 비교해주세요.',
    },
    {
        id: 'llama-3.3-70b', provider: 'cerebras', name: 'Llama 3.3 70B (Cerebras)',
        tagline: '대형 모델도 초고속으로',
        strengths: ['70B 모델의 초고속 추론', '깊은 분석력', '토큰 버킷 방식 (연속 사용 유리)'],
        icon: <Brain size={20} />, category: '범용', contextLength: '8K',
        testPrompt: '스타트업이 MVP를 3개월 안에 출시하기 위한 기술 스택 추천과 이유를 설명해주세요.',
    },

    // --- SambaNova ---
    {
        id: 'DeepSeek-R1', provider: 'sambanova', name: 'DeepSeek R1',
        tagline: '사고 과정을 보여주는 추론 전문 모델',
        strengths: ['Chain-of-Thought 추론', '수학/논리 문제 강점', '사고 과정 투명성'],
        icon: <Brain size={20} />, category: '추론', contextLength: '128K',
        testPrompt: '7명이 원탁에 둘러앉아 있습니다. 서로 인접한 사람끼리 악수를 하면, 총 악수 횟수는 몇 번인가요? 풀이 과정을 보여주세요.',
    },
    {
        id: 'Meta-Llama-3.3-70B-Instruct', provider: 'sambanova', name: 'Llama 3.3 70B (SambaNova)',
        tagline: 'SambaNova RDU 칩의 극한 처리량',
        strengths: ['RDU 맞춤 최적화', '배치 처리 강점', '한국어 지원'],
        icon: <Globe size={20} />, category: '범용', contextLength: '128K',
        testPrompt: '한국의 저출산 문제에 대한 원인과 해결 방안을 사회/경제/문화 관점에서 분석해주세요.',
    },
    {
        id: 'Qwen2.5-72B-Instruct', provider: 'sambanova', name: 'Qwen 2.5 72B',
        tagline: '알리바바의 다국어 대형 모델',
        strengths: ['중국어/영어/한국어 강점', '72B 파라미터', '코딩 능력 우수'],
        icon: <Globe size={20} />, category: '다국어', contextLength: '128K',
        testPrompt: '다음 문장을 한국어, 영어, 중국어, 일본어로 번역해주세요: "인공지능은 인류의 미래를 바꿀 것입니다."',
    },

    // --- OpenRouter ---
    {
        id: 'qwen/qwen3.6-plus:free', provider: 'openrouter', name: 'Qwen 3.6 Plus',
        tagline: '100만 토큰 컨텍스트 — 최강 추론',
        strengths: ['1M 컨텍스트 (최대)', '최신 추론 성능', '긴 문서 분석 가능'],
        icon: <Sparkles size={20} />, category: '추론', contextLength: '1M',
        testPrompt: '다음 논리 퍼즐을 풀어주세요: A는 B보다 키가 크고, C는 D보다 작습니다. B와 C는 같은 키이고, D는 A보다 큽니다. 4명을 키 순서대로 나열하세요.',
    },
    {
        id: 'qwen/qwen3-coder:free', provider: 'openrouter', name: 'Qwen 3 Coder',
        tagline: '코딩 전문 — 풀스택 개발 파트너',
        strengths: ['코드 생성/리팩토링 특화', '262K 컨텍스트', '버그 수정/코드 리뷰'],
        icon: <Code size={20} />, category: '코딩', contextLength: '262K',
        testPrompt: 'TypeScript로 간단한 TodoList REST API를 Express.js로 구현해주세요. CRUD 엔드포인트와 에러 핸들링을 포함해주세요.',
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', name: 'Llama 3.3 70B (OR)',
        tagline: '검증된 오픈소스 모델 via OpenRouter',
        strengths: ['안정적 성능', '풍부한 벤치마크', '지시 따르기 우수'],
        icon: <MessageSquare size={20} />, category: '대화', contextLength: '65K',
        testPrompt: '개발자 면접에서 자주 나오는 "본인의 강점과 약점"에 대한 모범 답변을 만들어주세요.',
    },
    {
        id: 'nvidia/nemotron-nano-12b-v2-vl:free', provider: 'openrouter', name: 'Nemotron Nano 12B VL',
        tagline: '비전+언어 멀티모달 모델',
        strengths: ['이미지 이해 가능', 'NVIDIA 최적화', '128K 컨텍스트'],
        icon: <Eye size={20} />, category: '비전', contextLength: '128K',
        testPrompt: 'UI/UX 디자인에서 접근성(Accessibility)을 고려한 색상 팔레트 설계 원칙 5가지를 설명해주세요.',
    },

    // --- Mistral ---
    {
        id: 'mistral-small-latest', provider: 'mistral', name: 'Mistral Small',
        tagline: '효율적인 유럽 AI — 빠르고 정확한',
        strengths: ['낮은 지연시간', '비용 효율적', '유럽 데이터 보호'],
        icon: <Zap size={20} />, category: '효율', contextLength: '128K',
        testPrompt: 'GDPR과 한국 개인정보보호법의 주요 차이점을 3가지로 비교해주세요.',
    },
    {
        id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large',
        tagline: 'Mistral의 최대 모델 — 깊은 분석력',
        strengths: ['복잡한 추론', '다국어 강점', '함수 호출 지원'],
        icon: <Brain size={20} />, category: '범용', contextLength: '128K',
        testPrompt: '마이크로서비스 아키텍처에서 이벤트 소싱(Event Sourcing)과 CQRS 패턴의 장단점을 분석해주세요.',
    },
    {
        id: 'codestral-latest', provider: 'mistral', name: 'Codestral',
        tagline: 'Mistral의 코딩 전문 모델',
        strengths: ['80+ 언어 지원', 'Fill-in-the-Middle', '코드 완성/생성 최적화'],
        icon: <Code size={20} />, category: '코딩', contextLength: '32K',
        testPrompt: 'Rust로 간단한 HTTP 서버를 만들어주세요. GET /hello 엔드포인트가 JSON 응답을 반환하도록 해주세요.',
    },

    // --- Gemini ---
    {
        id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash',
        tagline: 'Google의 최신 고성능 모델',
        strengths: ['멀티모달 지원', '긴 컨텍스트', 'Google 생태계 연동'],
        icon: <Sparkles size={20} />, category: '범용', contextLength: '1M',
        testPrompt: '기후변화가 한국 농업에 미치는 영향과 스마트 농업 기술의 대응 방안을 분석해주세요.',
    },
    {
        id: 'gemini-2.5-flash-lite', provider: 'gemini', name: 'Gemini 2.5 Flash Lite',
        tagline: '경량화된 Gemini — 더 높은 쿼타',
        strengths: ['1500 RPD (가장 높은 무료 한도)', '빠른 응답', '일상 작업에 최적'],
        icon: <Zap size={20} />, category: '속도', contextLength: '1M',
        testPrompt: '오늘 하루 생산성을 높이기 위한 시간 관리 팁 5가지를 알려주세요.',
    },
];

const CATEGORIES = ['전체', '범용', '추론', '코딩', '속도', '효율', '대화', '다국어', '비전'];

export default function ModelExplorerPage() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [testingModel, setTestingModel] = useState<string | null>(null);
    const [testResults, setTestResults] = useState<Record<string, {
        response: string;
        latencyMs: number;
        inputTokens: number;
        outputTokens: number;
        error?: string;
    }>>({});

    useEffect(() => {
        if (user) {
            getApiKeys(user.uid).then(setApiKeys);
        }
    }, [user]);

    const hasKey = useCallback((provider: AIProvider) => {
        return apiKeys.some(k => k.provider === provider && k.isActive);
    }, [apiKeys]);

    const runTest = async (modelInfo: ModelInfo) => {
        if (!user) return;
        const key = apiKeys.find(k => k.provider === modelInfo.provider && k.isActive);
        if (!key) return;

        setTestingModel(modelInfo.id);
        // Clear previous result for this model
        setTestResults(prev => {
            const next = { ...prev };
            delete next[modelInfo.id];
            return next;
        });

        try {
            const start = Date.now();
            const res = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: modelInfo.provider,
                    key: key.key,
                    model: modelInfo.id,
                    prompt: modelInfo.testPrompt,
                }),
            });
            const data = await res.json();
            const latency = data.latencyMs || (Date.now() - start);

            if (!res.ok) {
                setTestResults(prev => ({
                    ...prev,
                    [modelInfo.id]: {
                        response: '', latencyMs: latency,
                        inputTokens: 0, outputTokens: 0,
                        error: data.error?.message || `Error ${res.status}`,
                    },
                }));
            } else {
                setTestResults(prev => ({
                    ...prev,
                    [modelInfo.id]: {
                        response: data.text || '',
                        latencyMs: latency,
                        inputTokens: data.inputTokens || 0,
                        outputTokens: data.outputTokens || 0,
                    },
                }));
            }
        } catch (err: unknown) {
            setTestResults(prev => ({
                ...prev,
                [modelInfo.id]: {
                    response: '', latencyMs: 0,
                    inputTokens: 0, outputTokens: 0,
                    error: err instanceof Error ? err.message : 'Unknown error',
                },
            }));
        } finally {
            setTestingModel(null);
        }
    };

    const filteredModels = selectedCategory === '전체'
        ? MODEL_CATALOG
        : MODEL_CATALOG.filter(m => m.category === selectedCategory);

    // Group by provider for display
    const providers = ACTIVE_PROVIDERS.filter(p =>
        filteredModels.some(m => m.provider === p)
    );

    return (
        <div>
            <div className="page-header">
                <h2>🔍 모델 탐색기</h2>
                <p>연동된 {MODEL_CATALOG.length}개 AI 모델의 특징을 확인하고 바로 테스트하세요</p>
            </div>

            {/* Category filter */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 20,
                            border: selectedCategory === cat ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                            background: selectedCategory === cat ? 'rgba(66,133,244,0.15)' : 'var(--bg-secondary)',
                            color: selectedCategory === cat ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            fontSize: 13,
                            fontWeight: selectedCategory === cat ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Models by provider */}
            {providers.map(provider => {
                const config = PROVIDER_CONFIG[provider];
                const providerModels = filteredModels.filter(m => m.provider === provider);
                if (providerModels.length === 0) return null;

                return (
                    <div key={provider} style={{ marginBottom: 32 }}>
                        {/* Provider header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            marginBottom: 14, paddingBottom: 10,
                            borderBottom: `2px solid ${config.color}33`,
                        }}>
                            <div style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: config.color, boxShadow: `0 0 8px ${config.color}55`,
                            }} />
                            <span style={{ fontSize: 16, fontWeight: 700, color: config.color }}>
                                {config.name}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                {config.note || ''}
                            </span>
                            {!hasKey(provider) && (
                                <span style={{
                                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                    background: 'rgba(239,68,68,0.1)', color: 'var(--accent-red)',
                                    marginLeft: 'auto',
                                }}>
                                    키 미등록
                                </span>
                            )}
                        </div>

                        {/* Model cards */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                            gap: 14,
                        }}>
                            {providerModels.map(m => {
                                const result = testResults[m.id];
                                const isTesting = testingModel === m.id;

                                return (
                                    <div
                                        key={m.id}
                                        className="card"
                                        style={{
                                            borderColor: result?.error
                                                ? 'rgba(239,68,68,0.3)'
                                                : result
                                                    ? `${config.color}44`
                                                    : undefined,
                                            transition: 'all 0.3s',
                                        }}
                                    >
                                        {/* Header */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 8,
                                                background: `${config.color}18`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: config.color, flexShrink: 0,
                                            }}>
                                                {m.icon}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                    {m.tagline}
                                                </div>
                                            </div>
                                            <div style={{
                                                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                                background: `${config.color}15`, color: config.color,
                                                fontWeight: 600, whiteSpace: 'nowrap',
                                            }}>
                                                {m.category}
                                            </div>
                                        </div>

                                        {/* Strengths */}
                                        <div style={{ marginBottom: 10 }}>
                                            {m.strengths.map((s, i) => (
                                                <div key={i} style={{
                                                    fontSize: 12, color: 'var(--text-secondary)',
                                                    padding: '2px 0', display: 'flex', gap: 6,
                                                }}>
                                                    <span style={{ color: config.color }}>✦</span>
                                                    {s}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Context length badge */}
                                        <div style={{
                                            fontSize: 11, color: 'var(--text-tertiary)',
                                            marginBottom: 10,
                                        }}>
                                            📐 컨텍스트: {m.contextLength} | 🆔 {m.id}
                                        </div>

                                        {/* Test button */}
                                        <button
                                            onClick={() => runTest(m)}
                                            disabled={!hasKey(m.provider) || isTesting}
                                            style={{
                                                width: '100%', padding: '8px 12px',
                                                borderRadius: 8, border: 'none',
                                                background: hasKey(m.provider)
                                                    ? config.gradient
                                                    : 'var(--bg-tertiary)',
                                                color: hasKey(m.provider) ? '#fff' : 'var(--text-tertiary)',
                                                fontSize: 13, fontWeight: 600,
                                                cursor: hasKey(m.provider) ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                opacity: isTesting ? 0.7 : 1,
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {isTesting ? (
                                                <><div className="spinner" style={{ width: 14, height: 14 }} /> 테스트 중...</>
                                            ) : (
                                                <><Send size={13} /> 테스트 실행</>
                                            )}
                                        </button>

                                        {/* Test prompt preview */}
                                        <div style={{
                                            fontSize: 11, color: 'var(--text-tertiary)',
                                            marginTop: 6, fontStyle: 'italic',
                                            overflow: 'hidden', textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            💬 &ldquo;{m.testPrompt.slice(0, 60)}...&rdquo;
                                        </div>

                                        {/* Test result */}
                                        {result && (
                                            <div className="animate-in" style={{
                                                marginTop: 10, padding: 10, borderRadius: 8,
                                                background: 'var(--bg-primary)',
                                                border: `1px solid ${result.error ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                                                fontSize: 12,
                                            }}>
                                                {result.error ? (
                                                    <div style={{ color: 'var(--accent-red)' }}>
                                                        ❌ {result.error}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{
                                                            maxHeight: 150, overflowY: 'auto',
                                                            color: 'var(--text-primary)',
                                                            lineHeight: 1.5, marginBottom: 8,
                                                            whiteSpace: 'pre-wrap',
                                                        }}>
                                                            {result.response}
                                                        </div>
                                                        <div style={{
                                                            display: 'flex', gap: 12, flexWrap: 'wrap',
                                                            paddingTop: 6, borderTop: '1px solid var(--border-color)',
                                                            color: 'var(--text-tertiary)', fontSize: 11,
                                                        }}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <Clock size={10} /> {result.latencyMs.toLocaleString()}ms
                                                            </span>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <Hash size={10} /> {result.inputTokens + result.outputTokens} 토큰
                                                            </span>
                                                            <span>입력: {result.inputTokens} | 출력: {result.outputTokens}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
