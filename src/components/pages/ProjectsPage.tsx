'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getProjects, addProject, updateProject, deleteProject, getQALogs } from '@/lib/firestore';
import { Project, QALog, PROVIDER_CONFIG, AIProvider } from '@/lib/types';
import { Plus, Edit2, Trash2, FolderKanban, DollarSign, Hash } from 'lucide-react';

const PROJECT_COLORS = ['#4285F4', '#F55036', '#8B5CF6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f97316'];

export default function ProjectsPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectLogs, setProjectLogs] = useState<Record<string, QALog[]>>({});
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [showCostModal, setShowCostModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    // Form
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formTags, setFormTags] = useState('');
    const [formColor, setFormColor] = useState(PROJECT_COLORS[0]);

    const loadData = useCallback(async () => {
        if (!user) return;
        try {
            const projs = await getProjects(user.uid);
            setProjects(projs);

            // Load logs per project
            const logsMap: Record<string, QALog[]> = {};
            for (const p of projs) {
                const logs = await getQALogs(user.uid, { projectId: p.id });
                logsMap[p.id] = logs;
            }
            setProjectLogs(logsMap);
        } catch (err) {
            console.error('Load failed:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openAdd = () => {
        setEditingProject(null);
        setFormName('');
        setFormDesc('');
        setFormTags('');
        setFormColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
        setShowModal(true);
    };

    const openEdit = (p: Project) => {
        setEditingProject(p);
        setFormName(p.name);
        setFormDesc(p.description);
        setFormTags(p.tags.join(', '));
        setFormColor(p.color);
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!user || !formName.trim()) return;
        const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
        try {
            if (editingProject) {
                await updateProject(user.uid, editingProject.id, {
                    name: formName,
                    description: formDesc,
                    tags,
                    color: formColor,
                });
            } else {
                await addProject(user.uid, {
                    name: formName,
                    description: formDesc,
                    tags,
                    color: formColor,
                });
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            console.error('Save failed:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!user || !confirm('이 프로젝트를 삭제하시겠습니까?')) return;
        try {
            await deleteProject(user.uid, id);
            loadData();
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const getProjectStats = (projectId: string) => {
        const logs = projectLogs[projectId] || [];
        const totalTokens = logs.reduce((s, l) => s + l.totalTokens, 0);
        const totalRequests = logs.length;
        return { totalTokens, totalRequests, logs };
    };

    const calcCost = (logs: QALog[]) => {
        let total = 0;
        logs.forEach(log => {
            const config = PROVIDER_CONFIG[log.provider];
            if (config) {
                total += (log.inputTokens / 1000000) * config.costPer1MInput;
                total += (log.outputTokens / 1000000) * config.costPer1MOutput;
            }
        });
        return total;
    };

    const openCostSim = (p: Project) => {
        setSelectedProject(p);
        setShowCostModal(true);
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h2>프로젝트 관리</h2>
                    <p>프로젝트별 AI 자원 사용을 추적하고 비용을 시뮬레이션하세요</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={16} />
                    프로젝트 추가
                </button>
            </div>

            {loading ? (
                <div className="grid-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card"><div className="skeleton" style={{ height: 180 }} /></div>
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <FolderKanban size={48} />
                        <h3>프로젝트가 없습니다</h3>
                        <p>프로젝트를 생성하여 AI 사용을 체계적으로 관리하세요.</p>
                        <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 16 }}>
                            <Plus size={16} />
                            첫 프로젝트 생성
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid-3">
                    {projects.map(p => {
                        const stats = getProjectStats(p.id);
                        const cost = calcCost(stats.logs);
                        return (
                            <div key={p.id} className="card animate-in" style={{ position: 'relative', overflow: 'hidden' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.color }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 'var(--radius-md)',
                                            background: `${p.color}20`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: 14,
                                            color: p.color,
                                        }}>
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{p.description || '설명 없음'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <button className="btn-icon" onClick={() => openEdit(p)}><Edit2 size={14} /></button>
                                        <button className="btn-icon" onClick={() => handleDelete(p.id)} style={{ color: 'var(--accent-red)' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>

                                {p.tags.length > 0 && (
                                    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {p.tags.map(tag => (
                                            <span key={tag} className="tag tag-blue">{tag}</span>
                                        ))}
                                    </div>
                                )}

                                <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                    <div style={{ textAlign: 'center', padding: 8, borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>요청</div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.totalRequests}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', padding: 8, borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>토큰</div>
                                        <div style={{ fontSize: 18, fontWeight: 700 }}>{stats.totalTokens.toLocaleString()}</div>
                                    </div>
                                    <div
                                        style={{ textAlign: 'center', padding: 8, borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', cursor: 'pointer' }}
                                        onClick={() => openCostSim(p)}
                                    >
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>예상 비용</div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-green)' }}>${cost.toFixed(3)}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Project Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingProject ? '프로젝트 수정' : '프로젝트 추가'}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label>프로젝트 이름</label>
                            <input className="form-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="예: 웹 앱 개발" />
                        </div>
                        <div className="form-group">
                            <label>설명</label>
                            <textarea className="form-input" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="프로젝트 설명" style={{ minHeight: 80 }} />
                        </div>
                        <div className="form-group">
                            <label>태그 (쉼표로 구분)</label>
                            <input className="form-input" value={formTags} onChange={e => setFormTags(e.target.value)} placeholder="예: React, AI, 데이터분석" />
                        </div>
                        <div className="form-group">
                            <label>색상</label>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                {PROJECT_COLORS.map(c => (
                                    <div
                                        key={c}
                                        onClick={() => setFormColor(c)}
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            background: c,
                                            cursor: 'pointer',
                                            border: formColor === c ? '3px solid white' : '3px solid transparent',
                                            transition: 'border var(--transition-fast)',
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                            <button className="btn btn-primary" onClick={handleSave}>{editingProject ? '수정' : '생성'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cost Simulation Modal */}
            {showCostModal && selectedProject && (
                <div className="modal-overlay" onClick={() => setShowCostModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>💰 비용 시뮬레이션 - {selectedProject.name}</h3>
                            <button className="btn-icon" onClick={() => setShowCostModal(false)}>✕</button>
                        </div>

                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
                            현재 무료 티어 사용량을 유료 단가로 환산한 예상 비용입니다.
                        </p>

                        {(() => {
                            const logs = projectLogs[selectedProject.id] || [];
                            const byProvider: Record<string, { input: number; output: number; count: number }> = {};
                            logs.forEach(l => {
                                if (!byProvider[l.provider]) byProvider[l.provider] = { input: 0, output: 0, count: 0 };
                                byProvider[l.provider].input += l.inputTokens;
                                byProvider[l.provider].output += l.outputTokens;
                                byProvider[l.provider].count++;
                            });

                            let grandTotal = 0;

                            return (
                                <div className="cost-breakdown">
                                    {Object.entries(byProvider).map(([prov, data]) => {
                                        const config = PROVIDER_CONFIG[prov as AIProvider];
                                        const inputCost = (data.input / 1000000) * (config?.costPer1MInput || 0);
                                        const outputCost = (data.output / 1000000) * (config?.costPer1MOutput || 0);
                                        const total = inputCost + outputCost;
                                        grandTotal += total;

                                        return (
                                            <div key={prov} style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                    <span style={{ fontWeight: 600, color: config?.color }}>{config?.name || prov}</span>
                                                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>${total.toFixed(4)}</span>
                                                </div>
                                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 16 }}>
                                                    <span>요청: {data.count}건</span>
                                                    <span>입력: {data.input.toLocaleString()} 토큰</span>
                                                    <span>출력: {data.output.toLocaleString()} 토큰</span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="cost-row" style={{ fontWeight: 700, fontSize: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                                        <span>총 예상 비용</span>
                                        <span className="cost-value">${grandTotal.toFixed(4)}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
