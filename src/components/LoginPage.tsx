'use client';

import React from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Zap, Shield, BarChart3, Bot } from 'lucide-react';

export default function LoginPage() {
    const { signInWithGoogle } = useAuth();

    return (
        <div className="login-page">
            <div className="login-card animate-in">
                {/* Decorative background */}
                <div style={{
                    position: 'absolute',
                    top: '20%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 400,
                    height: 400,
                    background: 'radial-gradient(circle, rgba(66,133,244,0.08) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #4285F4, #8B5CF6, #F55036)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    boxShadow: '0 8px 32px rgba(66,133,244,0.3)',
                }}>
                    <Bot size={32} color="white" />
                </div>

                <h1>FreeAPI Hub</h1>
                <p>
                    Gemini, Groq, Cerebras 등 무료 AI API를<br />
                    한곳에서 관리하고 모니터링하세요
                </p>

                <button className="login-btn" onClick={signInWithGoogle}>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google로 시작하기
                </button>

                <div className="login-features">
                    <div className="login-feature">
                        <div className="login-feature-icon" style={{ background: 'rgba(66,133,244,0.12)' }}>
                            <BarChart3 size={16} color="#4285F4" />
                        </div>
                        <span>실시간 API 크레딧 모니터링</span>
                    </div>
                    <div className="login-feature">
                        <div className="login-feature-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
                            <Shield size={16} color="#10b981" />
                        </div>
                        <span>프로젝트별 사용량 추적 & 관리</span>
                    </div>
                    <div className="login-feature">
                        <div className="login-feature-icon" style={{ background: 'rgba(139,92,246,0.12)' }}>
                            <Zap size={16} color="#8B5CF6" />
                        </div>
                        <span>자동 폴백 & Rate Limit 방어</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
