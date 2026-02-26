'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';
import LoginPage from '@/components/LoginPage';
import DashboardPage from '@/components/pages/DashboardPage';
import ApiKeysPage from '@/components/pages/ApiKeysPage';
import ProjectsPage from '@/components/pages/ProjectsPage';
import QALogsPage from '@/components/pages/QALogsPage';
import PlaygroundPage from '@/components/pages/PlaygroundPage';
import { seedInitialData } from '@/lib/seedData';

export default function AppShell() {
    const { user, loading } = useAuth();
    const [currentPage, setCurrentPage] = useState('dashboard');
    const seeded = useRef(false);

    useEffect(() => {
        if (user && !seeded.current) {
            seeded.current = true;
            seedInitialData(user.uid);
        }
    }, [user]);

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                background: 'var(--bg-primary)',
            }}>
                <div className="spinner" style={{ width: 32, height: 32 }} />
            </div>
        );
    }

    if (!user) {
        return <LoginPage />;
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <DashboardPage />;
            case 'api-keys':
                return <ApiKeysPage />;
            case 'projects':
                return <ProjectsPage />;
            case 'qa-logs':
                return <QALogsPage />;
            case 'playground':
                return <PlaygroundPage />;
            default:
                return <DashboardPage />;
        }
    };

    return (
        <div className="app-layout">
            <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
            <main className="main-content">
                <div className="page-container">
                    {renderPage()}
                </div>
            </main>
        </div>
    );
}
