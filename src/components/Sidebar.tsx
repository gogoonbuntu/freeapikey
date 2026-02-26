'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
    LayoutDashboard,
    Key,
    FolderKanban,
    MessageSquareText,
    FlaskConical,
    LogOut,
    Menu,
    X,
} from 'lucide-react';

interface SidebarProps {
    currentPage: string;
    onNavigate: (page: string) => void;
}

const navItems = [
    { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, section: 'OVERVIEW' },
    { id: 'api-keys', label: 'API 키 관리', icon: Key, section: 'MANAGE' },
    { id: 'projects', label: '프로젝트', icon: FolderKanban, section: 'MANAGE' },
    { id: 'qa-logs', label: 'QA 로그', icon: MessageSquareText, section: 'ANALYZE' },
    { id: 'playground', label: '플레이그라운드', icon: FlaskConical, section: 'TOOLS' },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
    const { user, signOut } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    const sections = [...new Set(navItems.map(i => i.section))];

    const handleNav = (page: string) => {
        onNavigate(page);
        setMobileOpen(false);
    };

    return (
        <>
            {/* Mobile header */}
            <div className="mobile-header">
                <button className="btn-icon" onClick={() => setMobileOpen(!mobileOpen)}>
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <h1 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    marginLeft: 12,
                    background: 'linear-gradient(135deg, #4285F4, #8B5CF6, #F55036)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    FreeAPI Hub
                </h1>
            </div>

            {/* Sidebar */}
            <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    <h1>FreeAPI Hub</h1>
                    <span>AI Resource Control Center</span>
                </div>

                <nav className="sidebar-nav">
                    {sections.map(section => (
                        <div className="nav-section" key={section}>
                            <div className="nav-section-title">{section}</div>
                            {navItems
                                .filter(item => item.section === section)
                                .map(item => (
                                    <button
                                        key={item.id}
                                        className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                                        onClick={() => handleNav(item.id)}
                                    >
                                        <item.icon size={18} />
                                        {item.label}
                                    </button>
                                ))}
                        </div>
                    ))}
                </nav>

                {user && (
                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                            ) : (
                                user.displayName?.charAt(0) || 'U'
                            )}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user.displayName || 'User'}</div>
                            <div className="sidebar-user-email">{user.email}</div>
                        </div>
                        <button className="btn-icon" onClick={signOut} title="로그아웃" style={{ marginLeft: 'auto' }}>
                            <LogOut size={16} />
                        </button>
                    </div>
                )}
            </aside>

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 99,
                    }}
                    onClick={() => setMobileOpen(false)}
                />
            )}
        </>
    );
}
