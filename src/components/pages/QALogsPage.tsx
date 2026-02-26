'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getQALogs, getProjects } from '@/lib/firestore';
import { QALog, Project, PROVIDER_CONFIG, AIProvider } from '@/lib/types';
import { Search, Filter, AlertTriangle, MessageSquareText, ChevronLeft, Clock, Zap, Hash } from 'lucide-react';

export default function QALogsPage() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<QALog[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterProvider, setFilterProvider] = useState<string>('all');
    const [filterProject, setFilterProject] = useState<string>('all');
    const [selectedLog, setSelectedLog] = useState<QALog | null>(null);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const [allLogs, allProjects] = await Promise.all([
                getQALogs(user.uid),
                getProjects(user.uid),
            ]);
            setLogs(allLogs);
            setProjects(allProjects);
        } catch (err) {
            console.error('Failed to load QA logs:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredLogs = logs.filter(log => {
        if (filterProvider !== 'all' && log.provider !== filterProvider) return false;
        if (filterProject !== 'all' && log.projectId !== filterProject) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return (
                log.prompt.toLowerCase().includes(term) ||
                log.response.toLowerCase().includes(term) ||
                log.model.toLowerCase().includes(term)
            );
        }
        return true;
    });

    const getProjectName = (projectId: string) => {
        const p = projects.find(p => p.id === projectId);
        return p?.name || '미지정';
    };

    // Detail view
    if (selectedLog) {
        return (
            <div>
                <button className="btn btn-secondary" onClick={() => setSelectedLog(null)} style={{ marginBottom: 20 }}>
                    <ChevronLeft size={16} />
                    목록으로
                </button>

                <div className="card animate-in" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                            <span className={`tag tag-${selectedLog.provider === 'gemini' ? 'blue' : selectedLog.provider === 'groq' ? 'red' : 'purple'}`}>
                                {PROVIDER_CONFIG[selectedLog.provider]?.name}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--text-tertiary)', marginLeft: 12 }}>{selectedLog.model}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={12} />{selectedLog.latencyMs}ms
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Zap size={12} />{selectedLog.totalTokens.toLocaleString()} 토큰
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Hash size={12} />{getProjectName(selectedLog.projectId)}
                            </span>
                        </div>
                    </div>

                    {selectedLog.fallbackUsed && (
                        <div style={{
                            padding: '8px 12px',
                            background: 'rgba(245,158,11,0.1)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            color: 'var(--accent-yellow)',
                            marginBottom: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <AlertTriangle size={14} />
                            폴백 사용: {selectedLog.fallbackFrom} → {selectedLog.provider}
                        </div>
                    )}

                    {selectedLog.hasSensitiveData && (
                        <div style={{
                            padding: '8px 12px',
                            background: 'rgba(239,68,68,0.1)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: 13,
                            color: 'var(--accent-red)',
                            marginBottom: 16,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <AlertTriangle size={14} />
                            ⚠️ 민감 정보 포함 가능성 감지
                        </div>
                    )}
                </div>

                {/* Prompt */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header">
                        <h3 className="card-title" style={{ color: 'var(--accent-blue)' }}>💬 프롬프트</h3>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selectedLog.inputTokens.toLocaleString()} 토큰</span>
                    </div>
                    <div style={{
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text-secondary)',
                    }}>
                        {selectedLog.prompt}
                    </div>
                </div>

                {/* Response */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title" style={{ color: 'var(--accent-green)' }}>🤖 응답</h3>
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selectedLog.outputTokens.toLocaleString()} 토큰</span>
                    </div>
                    <div style={{
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-md)',
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        color: 'var(--text-secondary)',
                    }}>
                        {selectedLog.response}
                    </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
                    기록 시각: {selectedLog.createdAt.toLocaleString('ko-KR')}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h2>QA 로그</h2>
                <p>모든 AI 문답 내역을 검색하고 분석하세요</p>
            </div>

            {/* Search & Filter */}
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        className="form-input"
                        style={{ paddingLeft: 36 }}
                        placeholder="프롬프트, 응답, 모델명 검색..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="form-select" style={{ width: 160 }} value={filterProvider} onChange={e => setFilterProvider(e.target.value)}>
                    <option value="all">모든 프로바이더</option>
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="cerebras">Cerebras</option>
                </select>
                <select className="form-select" style={{ width: 160 }} value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                    <option value="all">모든 프로젝트</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>
            ) : filteredLogs.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <MessageSquareText size={48} />
                        <h3>{searchTerm || filterProvider !== 'all' || filterProject !== 'all' ? '검색 결과가 없습니다' : 'QA 기록이 없습니다'}</h3>
                        <p>플레이그라운드에서 AI 모델을 테스트하면 자동으로 기록됩니다.</p>
                    </div>
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>프로바이더</th>
                                <th>모델</th>
                                <th>프롬프트</th>
                                <th>프로젝트</th>
                                <th>토큰</th>
                                <th>응답시간</th>
                                <th>일시</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr key={log.id} onClick={() => setSelectedLog(log)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <span className={`tag tag-${log.provider === 'gemini' ? 'blue' : log.provider === 'groq' ? 'red' : 'purple'}`}>
                                            {PROVIDER_CONFIG[log.provider]?.name || log.provider}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 13 }}>{log.model}</td>
                                    <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.prompt}
                                    </td>
                                    <td style={{ fontSize: 13 }}>{getProjectName(log.projectId)}</td>
                                    <td>{log.totalTokens.toLocaleString()}</td>
                                    <td>{log.latencyMs}ms</td>
                                    <td style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                        {log.createdAt.toLocaleString('ko-KR')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
