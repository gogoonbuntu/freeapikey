'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getApiKeys } from '@/lib/firestore';
import { AIProvider, PROVIDER_CONFIG, ApiKey, ACTIVE_PROVIDERS } from '@/lib/types';
import { Zap, Clock, Hash, Send, Sparkles, Code, Eye, MessageSquare, Brain, Globe, Cpu, Star, Upload, Image as ImageIcon, X } from 'lucide-react';

// ===== Test mode types =====
type TestMode = 'text' | 'vision' | 'code' | 'reasoning' | 'multilang' | 'speed';

interface ModelInfo {
    id: string;
    provider: AIProvider;
    name: string;
    tagline: string;
    strengths: string[];
    icon: React.ReactNode;
    category: string;
    contextLength: string;
    testMode: TestMode;
    testPrompt: string;
    codeSnippet?: string; // For code models — buggy code to fix
}

const MODEL_CATALOG: ModelInfo[] = [
    // --- Groq ---
    {
        id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B',
        tagline: '메타의 범용 대형 모델 — 빠른 추론 속도',
        strengths: ['빠른 응답 속도 (Groq 하드웨어)', '범용 추론/대화', '70B 파라미터'],
        icon: <Brain size={20} />, category: '범용', contextLength: '128K',
        testMode: 'text',
        testPrompt: '양자 컴퓨팅이 기존 암호화 체계에 미치는 위협과 대응 방안을 3가지로 정리해주세요.',
    },
    {
        id: 'llama-3.1-8b-instant', provider: 'groq', name: 'Llama 3.1 8B',
        tagline: '초고속 경량 모델 — 가장 낮은 지연시간',
        strengths: ['극한의 속도 (<100ms)', '간단한 작업에 최적', '높은 RPD (14,400)'],
        icon: <Zap size={20} />, category: '속도', contextLength: '128K',
        testMode: 'speed',
        testPrompt: '1부터 10까지의 숫자를 각각 영어, 한국어, 일본어로 번역하세요. 표 형식으로 출력하세요.',
    },
    {
        id: 'gemma2-9b-it', provider: 'groq', name: 'Gemma 2 9B',
        tagline: 'Google의 오픈소스 경량 모델',
        strengths: ['Google 아키텍처', '높은 토큰 처리량 (15K TPM)', '효율적인 크기 대비 성능'],
        icon: <Star size={20} />, category: '효율', contextLength: '8K',
        testMode: 'text',
        testPrompt: '한국어로 하이쿠(5-7-5) 3수를 봄을 주제로 작성해주세요.',
    },

    // --- Cerebras ---
    {
        id: 'llama3.1-8b', provider: 'cerebras', name: 'Llama 3.1 8B (Cerebras)',
        tagline: '웨이퍼 스케일 칩 — 세계 최고 추론 속도',
        strengths: ['2000+ tok/s 출력 속도', '1M 일일 토큰', '실시간 스트리밍 체감'],
        icon: <Cpu size={20} />, category: '속도', contextLength: '8K',
        testMode: 'speed',
        testPrompt: 'REST API와 GraphQL의 차이를 표로 비교해주세요. 항목: 통신방식, 데이터 요청, 오버/언더 페칭, 캐싱, 학습 곡선.',
    },
    {
        id: 'llama-3.3-70b', provider: 'cerebras', name: 'Llama 3.3 70B (Cerebras)',
        tagline: '대형 모델도 초고속으로',
        strengths: ['70B 모델의 초고속 추론', '깊은 분석력', '토큰 버킷 방식 (연속 사용 유리)'],
        icon: <Brain size={20} />, category: '범용', contextLength: '8K',
        testMode: 'text',
        testPrompt: '스타트업이 MVP를 3개월 안에 출시하기 위한 기술 스택 추천과 이유를 설명해주세요.',
    },

    // --- SambaNova ---
    {
        id: 'DeepSeek-R1', provider: 'sambanova', name: 'DeepSeek R1',
        tagline: '사고 과정을 보여주는 추론 전문 모델',
        strengths: ['Chain-of-Thought 추론', '수학/논리 문제 강점', '사고 과정 투명성'],
        icon: <Brain size={20} />, category: '추론', contextLength: '128K',
        testMode: 'reasoning',
        testPrompt: '어떤 학교에서 학생들이 줄을 섭니다. 영수는 앞에서 7번째이고, 뒤에서 13번째입니다. 이 줄에 서있는 학생은 모두 몇 명인가요? 단계별로 풀이해주세요.',
    },
    {
        id: 'Meta-Llama-3.3-70B-Instruct', provider: 'sambanova', name: 'Llama 3.3 70B (SambaNova)',
        tagline: 'SambaNova RDU 칩의 극한 처리량',
        strengths: ['RDU 맞춤 최적화', '배치 처리 강점', '한국어 지원'],
        icon: <Globe size={20} />, category: '범용', contextLength: '128K',
        testMode: 'text',
        testPrompt: '한국의 저출산 문제에 대한 원인과 해결 방안을 사회/경제/문화 관점에서 분석해주세요.',
    },
    {
        id: 'Qwen2.5-72B-Instruct', provider: 'sambanova', name: 'Qwen 2.5 72B',
        tagline: '알리바바의 다국어 대형 모델',
        strengths: ['중국어/영어/한국어 강점', '72B 파라미터', '코딩 능력 우수'],
        icon: <Globe size={20} />, category: '다국어', contextLength: '128K',
        testMode: 'multilang',
        testPrompt: '다음 문장을 한국어, 영어, 중국어, 일본어로 번역하고, 각 언어의 뉘앙스 차이를 설명해주세요: "시간은 금이다"',
    },

    // --- OpenRouter ---
    {
        id: 'qwen/qwen3.6-plus:free', provider: 'openrouter', name: 'Qwen 3.6 Plus',
        tagline: '100만 토큰 컨텍스트 — 최강 추론',
        strengths: ['1M 컨텍스트 (최대)', '최신 추론 성능', '긴 문서 분석 가능'],
        icon: <Sparkles size={20} />, category: '추론', contextLength: '1M',
        testMode: 'reasoning',
        testPrompt: '한 농부가 여우, 닭, 곡식을 배로 강을 건너야 합니다. 배에는 농부와 하나만 실을 수 있습니다. 여우-닭, 닭-곡식은 같이 두면 안 됩니다. 가능한 모든 해법을 찾고, 최소 이동 횟수를 증명해주세요.',
    },
    {
        id: 'qwen/qwen3-coder:free', provider: 'openrouter', name: 'Qwen 3 Coder',
        tagline: '코딩 전문 — 풀스택 개발 파트너',
        strengths: ['코드 생성/리팩토링 특화', '262K 컨텍스트', '버그 수정/코드 리뷰'],
        icon: <Code size={20} />, category: '코딩', contextLength: '262K',
        testMode: 'code',
        testPrompt: '아래 코드의 버그를 찾아 수정하고, 왜 문제가 발생하는지 설명해주세요:\n\n```javascript\nfunction findDuplicates(arr) {\n  const seen = {};\n  const duplicates = [];\n  for (let i = 0; i <= arr.length; i++) {\n    if (seen[arr[i]]) {\n      duplicates.push(arr[i]);\n    }\n    seen[arr[i]] = true;\n  }\n  return [...new Set(duplicates)];\n}\nconsole.log(findDuplicates([1, 2, 3, 2, 4, 3, 5]));\n```',
        codeSnippet: `function findDuplicates(arr) {\n  const seen = {};\n  const duplicates = [];\n  for (let i = 0; i <= arr.length; i++) {\n    if (seen[arr[i]]) {\n      duplicates.push(arr[i]);\n    }\n    seen[arr[i]] = true;\n  }\n  return [...new Set(duplicates)];\n}\nconsole.log(findDuplicates([1, 2, 3, 2, 4, 3, 5]));`,
    },
    {
        id: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', name: 'Llama 3.3 70B (OR)',
        tagline: '검증된 오픈소스 모델 via OpenRouter',
        strengths: ['안정적 성능', '풍부한 벤치마크', '지시 따르기 우수'],
        icon: <MessageSquare size={20} />, category: '대화', contextLength: '65K',
        testMode: 'text',
        testPrompt: '당신은 시니어 개발자입니다. 주니어 개발자에게 "좋은 코드 리뷰를 하는 방법"을 가르치세요. 실제 사례를 들어 설명해주세요.',
    },
    {
        id: 'nvidia/nemotron-nano-12b-v2-vl:free', provider: 'openrouter', name: 'Nemotron Nano 12B VL',
        tagline: '비전+언어 멀티모달 모델',
        strengths: ['이미지 이해 가능', 'NVIDIA 최적화', '128K 컨텍스트'],
        icon: <Eye size={20} />, category: '비전', contextLength: '128K',
        testMode: 'vision',
        testPrompt: '이 이미지를 분석해주세요. 무엇이 보이나요? 주요 요소, 색상, 구도를 설명해주세요.',
    },

    // --- Mistral ---
    {
        id: 'mistral-small-latest', provider: 'mistral', name: 'Mistral Small',
        tagline: '효율적인 유럽 AI — 빠르고 정확한',
        strengths: ['낮은 지연시간', '비용 효율적', '유럽 데이터 보호'],
        icon: <Zap size={20} />, category: '효율', contextLength: '128K',
        testMode: 'text',
        testPrompt: 'GDPR과 한국 개인정보보호법의 주요 차이점을 3가지로 비교해주세요.',
    },
    {
        id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large',
        tagline: 'Mistral의 최대 모델 — 깊은 분석력',
        strengths: ['복잡한 추론', '다국어 강점', '함수 호출 지원'],
        icon: <Brain size={20} />, category: '범용', contextLength: '128K',
        testMode: 'reasoning',
        testPrompt: '트롤리 문제의 5가지 변형을 제시하고, 각각에 대한 공리주의와 의무론적 윤리학의 답변을 비교 분석해주세요.',
    },
    {
        id: 'codestral-latest', provider: 'mistral', name: 'Codestral',
        tagline: 'Mistral의 코딩 전문 모델',
        strengths: ['80+ 언어 지원', 'Fill-in-the-Middle', '코드 완성/생성 최적화'],
        icon: <Code size={20} />, category: '코딩', contextLength: '32K',
        testMode: 'code',
        testPrompt: '아래 Python 코드를 리팩토링하여 성능, 가독성, 에러 핸들링을 개선해주세요:\n\n```python\ndef get_user_data(users, id):\n    for i in range(len(users)):\n        if users[i]["id"] == id:\n            return users[i]["name"] + " " + users[i]["email"]\n    return None\n\ndef process_orders(orders):\n    result = []\n    for o in orders:\n        if o["status"] == "active":\n            if o["total"] > 100:\n                result.append(o)\n    return result\n```',
        codeSnippet: `def get_user_data(users, id):\n    for i in range(len(users)):\n        if users[i]["id"] == id:\n            return users[i]["name"] + " " + users[i]["email"]\n    return None\n\ndef process_orders(orders):\n    result = []\n    for o in orders:\n        if o["status"] == "active":\n            if o["total"] > 100:\n                result.append(o)\n    return result`,
    },

    // --- Gemini ---
    {
        id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash',
        tagline: 'Google의 최신 고성능 모델',
        strengths: ['멀티모달 지원', '긴 컨텍스트', 'Google 생태계 연동'],
        icon: <Sparkles size={20} />, category: '범용', contextLength: '1M',
        testMode: 'vision',
        testPrompt: '이 이미지에 대해 자세히 설명해주세요. 어떤 장면이고, 주요 오브젝트와 분위기를 분석해주세요.',
    },
    {
        id: 'gemini-2.5-flash-lite', provider: 'gemini', name: 'Gemini 2.5 Flash Lite',
        tagline: '경량화된 Gemini — 더 높은 쿼타',
        strengths: ['1500 RPD (가장 높은 무료 한도)', '빠른 응답', '일상 작업에 최적'],
        icon: <Zap size={20} />, category: '속도', contextLength: '1M',
        testMode: 'speed',
        testPrompt: '한국의 4계절(봄, 여름, 가을, 겨울)에 대해 각각 2문장으로 특징을 설명하세요.',
    },
];

const CATEGORIES = ['전체', '범용', '추론', '코딩', '속도', '효율', '대화', '다국어', '비전'];

const TEST_MODE_LABELS: Record<TestMode, { label: string; color: string; icon: React.ReactNode }> = {
    text: { label: '텍스트', color: '#4285F4', icon: <MessageSquare size={12} /> },
    vision: { label: '비전 (이미지)', color: '#34A853', icon: <Eye size={12} /> },
    code: { label: '코드 리뷰', color: '#8B5CF6', icon: <Code size={12} /> },
    reasoning: { label: '추론 퍼즐', color: '#FF6B00', icon: <Brain size={12} /> },
    multilang: { label: '다국어 번역', color: '#F55036', icon: <Globe size={12} /> },
    speed: { label: '속도 측정', color: '#FFB800', icon: <Zap size={12} /> },
};

export default function ModelExplorerPage() {
    const { user } = useAuth();
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('전체');
    const [testingModel, setTestingModel] = useState<string | null>(null);
    const [uploadedImages, setUploadedImages] = useState<Record<string, { data: string; mimeType: string; preview: string }>>({});
    const [testResults, setTestResults] = useState<Record<string, {
        response: string;
        latencyMs: number;
        inputTokens: number;
        outputTokens: number;
        error?: string;
    }>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        if (user) {
            getApiKeys(user.uid).then(setApiKeys);
        }
    }, [user]);

    const hasKey = useCallback((provider: AIProvider) => {
        return apiKeys.some(k => k.provider === provider && k.isActive);
    }, [apiKeys]);

    const handleImageUpload = (modelId: string, file: File) => {
        if (file.size > 4 * 1024 * 1024) {
            alert('이미지는 4MB 이하만 지원됩니다.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Extract base64 data without the data URL prefix
            const base64 = result.split(',')[1];
            setUploadedImages(prev => ({
                ...prev,
                [modelId]: {
                    data: base64,
                    mimeType: file.type,
                    preview: result,
                },
            }));
        };
        reader.readAsDataURL(file);
    };

    const removeImage = (modelId: string) => {
        setUploadedImages(prev => {
            const next = { ...prev };
            delete next[modelId];
            return next;
        });
    };

    const runTest = async (modelInfo: ModelInfo) => {
        if (!user) return;
        const key = apiKeys.find(k => k.provider === modelInfo.provider && k.isActive);
        if (!key) return;

        // For vision models, check if image is uploaded
        if (modelInfo.testMode === 'vision' && !uploadedImages[modelInfo.id]) {
            alert('비전 모델 테스트를 위해 이미지를 먼저 업로드해주세요.');
            return;
        }

        setTestingModel(modelInfo.id);
        setTestResults(prev => {
            const next = { ...prev };
            delete next[modelInfo.id];
            return next;
        });

        try {
            const img = uploadedImages[modelInfo.id];
            const body: Record<string, unknown> = {
                provider: modelInfo.provider,
                key: key.key,
                model: modelInfo.id,
                prompt: modelInfo.testPrompt,
            };
            if (img) {
                body.image = img.data;
                body.mimeType = img.mimeType;
            }

            const start = Date.now();
            const res = await fetch('/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
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

    const providers = ACTIVE_PROVIDERS.filter(p =>
        filteredModels.some(m => m.provider === p)
    );

    return (
        <div>
            <div className="page-header">
                <h2>🔍 모델 탐색기</h2>
                <p>연동된 {MODEL_CATALOG.length}개 AI 모델의 특징을 확인하고 특화 테스트로 검증하세요</p>
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

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                            gap: 14,
                        }}>
                            {providerModels.map(m => {
                                const result = testResults[m.id];
                                const isTesting = testingModel === m.id;
                                const modeInfo = TEST_MODE_LABELS[m.testMode];
                                const img = uploadedImages[m.id];

                                return (
                                    <div key={m.id} className="card" style={{
                                        borderColor: result?.error ? 'rgba(239,68,68,0.3)' : result ? `${config.color}44` : undefined,
                                        transition: 'all 0.3s',
                                    }}>
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
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                                                <div style={{
                                                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                                    background: `${config.color}15`, color: config.color,
                                                    fontWeight: 600, whiteSpace: 'nowrap',
                                                }}>
                                                    {m.category}
                                                </div>
                                                <div style={{
                                                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                                    background: `${modeInfo.color}15`, color: modeInfo.color,
                                                    fontWeight: 600, whiteSpace: 'nowrap',
                                                    display: 'flex', alignItems: 'center', gap: 3,
                                                }}>
                                                    {modeInfo.icon} {modeInfo.label}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Strengths */}
                                        <div style={{ marginBottom: 10 }}>
                                            {m.strengths.map((s, i) => (
                                                <div key={i} style={{
                                                    fontSize: 12, color: 'var(--text-secondary)',
                                                    padding: '2px 0', display: 'flex', gap: 6,
                                                }}>
                                                    <span style={{ color: config.color }}>✦</span> {s}
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                                            📐 컨텍스트: {m.contextLength} | 🆔 {m.id}
                                        </div>

                                        {/* === Test Mode Specific UI === */}

                                        {/* VISION: Image upload area */}
                                        {m.testMode === 'vision' && (
                                            <div style={{ marginBottom: 10 }}>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    ref={el => { fileInputRefs.current[m.id] = el; }}
                                                    style={{ display: 'none' }}
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleImageUpload(m.id, file);
                                                    }}
                                                />
                                                {img ? (
                                                    <div style={{
                                                        position: 'relative', borderRadius: 8, overflow: 'hidden',
                                                        border: '1px solid var(--border-color)',
                                                    }}>
                                                        <img
                                                            src={img.preview}
                                                            alt="uploaded"
                                                            style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
                                                        />
                                                        <button
                                                            onClick={() => removeImage(m.id)}
                                                            style={{
                                                                position: 'absolute', top: 6, right: 6,
                                                                width: 24, height: 24, borderRadius: '50%',
                                                                background: 'rgba(0,0,0,0.7)', border: 'none',
                                                                color: '#fff', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            }}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                        <div style={{
                                                            padding: '4px 8px', background: 'rgba(0,0,0,0.6)',
                                                            fontSize: 11, color: '#fff',
                                                        }}>
                                                            ✅ 이미지 업로드 완료 — 테스트 실행 시 이미지를 분석합니다
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => fileInputRefs.current[m.id]?.click()}
                                                        style={{
                                                            width: '100%', padding: '16px 12px',
                                                            borderRadius: 8,
                                                            border: '2px dashed var(--border-color)',
                                                            background: 'var(--bg-primary)',
                                                            color: 'var(--text-secondary)',
                                                            cursor: 'pointer', fontSize: 13,
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                                            transition: 'all 0.2s',
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.borderColor = modeInfo.color;
                                                            e.currentTarget.style.color = modeInfo.color;
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.borderColor = 'var(--border-color)';
                                                            e.currentTarget.style.color = 'var(--text-secondary)';
                                                        }}
                                                    >
                                                        <Upload size={20} />
                                                        <span>📸 이미지를 드래그하거나 클릭하여 업로드</span>
                                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                            JPG, PNG, WebP (최대 4MB)
                                                        </span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* CODE: Code snippet preview */}
                                        {m.testMode === 'code' && m.codeSnippet && (
                                            <div style={{
                                                marginBottom: 10, padding: 10, borderRadius: 8,
                                                background: '#1a1a2e', border: '1px solid #2d2d44',
                                                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.6,
                                                color: '#e0e0e0', maxHeight: 140, overflowY: 'auto',
                                                whiteSpace: 'pre-wrap',
                                            }}>
                                                <div style={{ fontSize: 10, color: '#888', marginBottom: 4, fontFamily: 'inherit' }}>
                                                    🐛 버그가 있는 코드:
                                                </div>
                                                {m.codeSnippet}
                                            </div>
                                        )}

                                        {/* REASONING: Puzzle preview */}
                                        {m.testMode === 'reasoning' && (
                                            <div style={{
                                                marginBottom: 10, padding: 10, borderRadius: 8,
                                                background: 'rgba(255,107,0,0.05)',
                                                border: '1px solid rgba(255,107,0,0.2)',
                                                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                                            }}>
                                                <div style={{ fontSize: 10, color: modeInfo.color, marginBottom: 4, fontWeight: 600 }}>
                                                    🧩 추론 퍼즐:
                                                </div>
                                                {m.testPrompt.slice(0, 120)}...
                                            </div>
                                        )}

                                        {/* SPEED: Speed focus label */}
                                        {m.testMode === 'speed' && (
                                            <div style={{
                                                marginBottom: 10, padding: '6px 10px', borderRadius: 8,
                                                background: 'rgba(255,184,0,0.08)',
                                                border: '1px solid rgba(255,184,0,0.2)',
                                                fontSize: 12, color: '#FFB800',
                                                display: 'flex', alignItems: 'center', gap: 6,
                                            }}>
                                                <Zap size={14} /> 속도 측정 모드 — 응답 시간이 강조됩니다
                                            </div>
                                        )}

                                        {/* MULTILANG: language preview */}
                                        {m.testMode === 'multilang' && (
                                            <div style={{
                                                marginBottom: 10, padding: '6px 10px', borderRadius: 8,
                                                background: 'rgba(245,80,54,0.05)',
                                                border: '1px solid rgba(245,80,54,0.2)',
                                                fontSize: 12, color: 'var(--text-secondary)',
                                                display: 'flex', alignItems: 'center', gap: 6,
                                            }}>
                                                <Globe size={14} color={modeInfo.color} /> 🇰🇷 🇺🇸 🇨🇳 🇯🇵 4개국어 번역 + 뉘앙스 비교
                                            </div>
                                        )}

                                        {/* Default text test prompt */}
                                        {m.testMode === 'text' && (
                                            <div style={{
                                                fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10,
                                                fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis',
                                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                            }}>
                                                💬 &ldquo;{m.testPrompt}&rdquo;
                                            </div>
                                        )}

                                        {/* Test button */}
                                        <button
                                            onClick={() => runTest(m)}
                                            disabled={!hasKey(m.provider) || isTesting || (m.testMode === 'vision' && !img)}
                                            style={{
                                                width: '100%', padding: '8px 12px',
                                                borderRadius: 8, border: 'none',
                                                background: hasKey(m.provider) && (m.testMode !== 'vision' || img)
                                                    ? config.gradient
                                                    : 'var(--bg-tertiary)',
                                                color: hasKey(m.provider) ? '#fff' : 'var(--text-tertiary)',
                                                fontSize: 13, fontWeight: 600,
                                                cursor: hasKey(m.provider) && (m.testMode !== 'vision' || img) ? 'pointer' : 'not-allowed',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                opacity: isTesting ? 0.7 : 1,
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {isTesting ? (
                                                <><div className="spinner" style={{ width: 14, height: 14 }} /> 테스트 중...</>
                                            ) : m.testMode === 'vision' && !img ? (
                                                <><ImageIcon size={13} /> 이미지를 먼저 업로드하세요</>
                                            ) : (
                                                <><Send size={13} /> {modeInfo.label} 테스트 실행</>
                                            )}
                                        </button>

                                        {/* Test result */}
                                        {result && (
                                            <div className="animate-in" style={{
                                                marginTop: 10, padding: 10, borderRadius: 8,
                                                background: 'var(--bg-primary)',
                                                border: `1px solid ${result.error ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
                                                fontSize: 12,
                                            }}>
                                                {result.error ? (
                                                    <div style={{ color: 'var(--accent-red)' }}>❌ {result.error}</div>
                                                ) : (
                                                    <>
                                                        {/* Speed mode: highlight latency */}
                                                        {m.testMode === 'speed' && (
                                                            <div style={{
                                                                textAlign: 'center', padding: '8px 0', marginBottom: 8,
                                                                borderBottom: '1px solid var(--border-color)',
                                                            }}>
                                                                <div style={{ fontSize: 28, fontWeight: 800, color: '#FFB800' }}>
                                                                    {result.latencyMs.toLocaleString()}ms
                                                                </div>
                                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                                    응답 시간 | {result.outputTokens > 0 ? Math.round(result.outputTokens / (result.latencyMs / 1000)) : '—'} tok/s
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Code mode: syntax-like display */}
                                                        <div style={{
                                                            maxHeight: 200, overflowY: 'auto',
                                                            color: 'var(--text-primary)',
                                                            lineHeight: 1.6, marginBottom: 8,
                                                            whiteSpace: 'pre-wrap',
                                                            fontFamily: m.testMode === 'code' ? 'monospace' : 'inherit',
                                                            fontSize: m.testMode === 'code' ? 11 : 12,
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
