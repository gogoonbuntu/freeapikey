'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getApiKeys, addApiKey, updateApiKey, deleteApiKey } from '@/lib/firestore';
import { ApiKey, AIProvider, PROVIDER_CONFIG } from '@/lib/types';
import { Plus, Edit2, Trash2, Eye, EyeOff, Key, AlertTriangle } from 'lucide-react';

export default function ApiKeysPage() {
    const { user } = useAuth();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

    // Form state
    const [formProvider, setFormProvider] = useState<AIProvider>('gemini');
    const [formKey, setFormKey] = useState('');
    const [formLabel, setFormLabel] = useState('');
    const [formRPM, setFormRPM] = useState('');
    const [formRPD, setFormRPD] = useState('');
    const [formTPD, setFormTPD] = useState('');

    const loadKeys = useCallback(async () => {
        if (!user) return;
        try {
            const data = await getApiKeys(user.uid);
            setKeys(data);
        } catch (err) {
            console.error('Failed to load API keys:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadKeys();
    }, [loadKeys]);

    const maskKey = (key: string) => {
        if (key.length <= 8) return '••••••••';
        return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
    };

    const toggleKeyVisibility = (keyId: string) => {
        setVisibleKeys(prev => {
            const next = new Set(prev);
            if (next.has(keyId)) next.delete(keyId);
            else next.add(keyId);
            return next;
        });
    };

    const openAdd = () => {
        setEditingKey(null);
        setFormProvider('gemini');
        setFormKey('');
        setFormLabel('');
        const defaults = PROVIDER_CONFIG.gemini.defaultLimits;
        setFormRPM(String(defaults.rpm || ''));
        setFormRPD(String(defaults.rpd || ''));
        setFormTPD(String(defaults.tpd || defaults.dailyTokenLimit || ''));
        setShowModal(true);
    };

    const openEdit = (key: ApiKey) => {
        setEditingKey(key);
        setFormProvider(key.provider);
        setFormKey(key.key);
        setFormLabel(key.label);
        setFormRPM(String(key.limits.rpm || ''));
        setFormRPD(String(key.limits.rpd || ''));
        setFormTPD(String(key.limits.tpd || key.limits.dailyTokenLimit || ''));
        setShowModal(true);
    };

    const handleProviderChange = (provider: AIProvider) => {
        setFormProvider(provider);
        if (!editingKey) {
            const defaults = PROVIDER_CONFIG[provider].defaultLimits;
            setFormRPM(String(defaults.rpm || ''));
            setFormRPD(String(defaults.rpd || ''));
            setFormTPD(String(defaults.tpd || defaults.dailyTokenLimit || ''));
        }
    };

    const handleSave = async () => {
        if (!user || !formKey.trim()) return;
        const limits = {
            rpm: formRPM ? parseInt(formRPM) : undefined,
            rpd: formRPD ? parseInt(formRPD) : undefined,
            tpd: formTPD ? parseInt(formTPD) : undefined,
        };

        try {
            if (editingKey) {
                await updateApiKey(user.uid, editingKey.id, {
                    provider: formProvider,
                    key: formKey,
                    label: formLabel,
                    limits,
                });
            } else {
                await addApiKey(user.uid, {
                    provider: formProvider,
                    key: formKey,
                    label: formLabel || `${PROVIDER_CONFIG[formProvider].name} Key`,
                    limits,
                    isActive: true,
                });
            }
            setShowModal(false);
            loadKeys();
        } catch (err) {
            console.error('Failed to save API key:', err);
        }
    };

    const handleDelete = async (keyId: string) => {
        if (!user) return;
        if (!confirm('이 API 키를 삭제하시겠습니까?')) return;
        try {
            await deleteApiKey(user.uid, keyId);
            loadKeys();
        } catch (err) {
            console.error('Failed to delete API key:', err);
        }
    };

    const groupedKeys: Record<string, ApiKey[]> = {};
    keys.forEach(k => {
        if (!groupedKeys[k.provider]) groupedKeys[k.provider] = [];
        groupedKeys[k.provider].push(k);
    });

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h2>API 키 관리</h2>
                    <p>AI 프로바이더별 API 키를 안전하게 관리하세요</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}>
                    <Plus size={16} />
                    키 추가
                </button>
            </div>

            {/* Security Notice */}
            <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 12, alignItems: 'flex-start', borderColor: 'rgba(245,158,11,0.3)' }}>
                <AlertTriangle size={20} color="var(--accent-yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--accent-yellow)' }}>보안 안내:</strong> API 키는 Firebase Firestore에 저장됩니다.
                    Firestore Security Rules를 통해 본인만 접근 가능하도록 설정되어 있습니다.
                    프로덕션 환경에서는 서버사이드 프록시를 통한 키 관리를 권장합니다.
                </div>
            </div>

            {loading ? (
                <div className="grid-2">
                    {[1, 2].map(i => (
                        <div key={i} className="card">
                            <div className="skeleton" style={{ height: 150 }} />
                        </div>
                    ))}
                </div>
            ) : keys.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <Key size={48} />
                        <h3>등록된 API 키가 없습니다</h3>
                        <p>Gemini, Groq, Cerebras 등의 API 키를 추가하여 시작하세요.</p>
                        <button className="btn btn-primary" onClick={openAdd} style={{ marginTop: 16 }}>
                            <Plus size={16} />
                            첫 번째 키 추가
                        </button>
                    </div>
                </div>
            ) : (
                Object.entries(groupedKeys).map(([provider, providerKeys]) => (
                    <div key={provider} style={{ marginBottom: 24 }}>
                        <h3 style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: PROVIDER_CONFIG[provider as AIProvider]?.color || 'var(--text-primary)',
                            marginBottom: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}>
                            <span className={`provider-dot ${provider}`} />
                            {PROVIDER_CONFIG[provider as AIProvider]?.name || provider}
                            <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>({providerKeys.length})</span>
                        </h3>
                        <div className="grid-2">
                            {providerKeys.map(key => (
                                <div key={key.id} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: 3,
                                        background: PROVIDER_CONFIG[key.provider]?.gradient || 'var(--accent-blue)',
                                    }} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{key.label}</div>
                                            <div style={{
                                                fontFamily: 'monospace',
                                                fontSize: 13,
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                            }}>
                                                {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                                                <button className="btn-icon" onClick={() => toggleKeyVisibility(key.id)} style={{ padding: 4 }}>
                                                    {visibleKeys.has(key.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-icon" onClick={() => openEdit(key)}>
                                                <Edit2 size={14} />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDelete(key.id)} style={{ color: 'var(--accent-red)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 16, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                        {key.limits.rpm && <span>RPM: {key.limits.rpm}</span>}
                                        {key.limits.rpd && <span>RPD: {key.limits.rpd.toLocaleString()}</span>}
                                        {(key.limits.tpd || key.limits.dailyTokenLimit) && (
                                            <span>TPD: {(key.limits.tpd || key.limits.dailyTokenLimit || 0).toLocaleString()}</span>
                                        )}
                                    </div>

                                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        추가: {key.createdAt.toLocaleDateString('ko-KR')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingKey ? 'API 키 수정' : 'API 키 추가'}</h3>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="form-group">
                            <label>프로바이더</label>
                            <select
                                className="form-select"
                                value={formProvider}
                                onChange={e => handleProviderChange(e.target.value as AIProvider)}
                            >
                                <option value="gemini">Google Gemini</option>
                                <option value="groq">Groq Cloud</option>
                                <option value="cerebras">Cerebras</option>
                                <option value="custom">Custom</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>라벨 (선택)</label>
                            <input
                                className="form-input"
                                value={formLabel}
                                onChange={e => setFormLabel(e.target.value)}
                                placeholder="예: 개인 프로젝트용"
                            />
                        </div>

                        <div className="form-group">
                            <label>API 키</label>
                            <input
                                className="form-input"
                                value={formKey}
                                onChange={e => setFormKey(e.target.value)}
                                placeholder="API 키를 입력하세요"
                                type="password"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            <div className="form-group">
                                <label>RPM</label>
                                <input
                                    className="form-input"
                                    value={formRPM}
                                    onChange={e => setFormRPM(e.target.value)}
                                    type="number"
                                    placeholder="분당 요청"
                                />
                            </div>
                            <div className="form-group">
                                <label>RPD</label>
                                <input
                                    className="form-input"
                                    value={formRPD}
                                    onChange={e => setFormRPD(e.target.value)}
                                    type="number"
                                    placeholder="일일 요청"
                                />
                            </div>
                            <div className="form-group">
                                <label>TPD</label>
                                <input
                                    className="form-input"
                                    value={formTPD}
                                    onChange={e => setFormTPD(e.target.value)}
                                    type="number"
                                    placeholder="일일 토큰"
                                />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
                            <button className="btn btn-primary" onClick={handleSave}>
                                {editingKey ? '수정' : '추가'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
