'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './EmailDashboard.module.css';
import { EmailCard } from '../EmailCard';
import { EmailHeatmap } from '../EmailHeatmap';
import type { AnalyzedEmail, Priority, ActionType } from '@/lib/gemini/service';

interface EmailStats {
    total: number;
    high: number;
    medium: number;
    low: number;
    needsResponse: number;
}

interface ConnectionStatus {
    connected: boolean;
    email?: string;
}

type FilterType = 'all' | Priority | ActionType;

export function EmailDashboard() {
    const [emails, setEmails] = useState<AnalyzedEmail[]>([]);
    const [stats, setStats] = useState<EmailStats | null>(null);
    const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');
    const [showHeatmap, setShowHeatmap] = useState(true);

    const checkConnection = useCallback(async () => {
        try {
            const res = await fetch('/api/email/status');
            const data = await res.json();
            setStatus(data);
            return data.connected;
        } catch {
            setStatus({ connected: false });
            return false;
        }
    }, []);

    const fetchEmails = useCallback(async () => {
        try {
            const res = await fetch('/api/email/starred');
            if (!res.ok) {
                if (res.status === 401) {
                    setStatus({ connected: false });
                    return;
                }
                throw new Error('Failed to fetch');
            }
            const data = await res.json();

            // Convert date strings back to Date objects
            const emailsWithDates = data.emails.map((email: AnalyzedEmail) => ({
                ...email,
                date: new Date(email.date),
            }));

            setEmails(emailsWithDates);
            setStats(data.stats);
        } catch (error) {
            console.error('Error fetching emails:', error);
        }
    }, []);

    const refresh = async () => {
        setRefreshing(true);
        await fetchEmails();
        setRefreshing(false);
    };

    const disconnect = async () => {
        try {
            await fetch('/api/email/status', { method: 'DELETE' });
            setStatus({ connected: false });
            setEmails([]);
            setStats(null);
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    };

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const connected = await checkConnection();
            if (connected) {
                await fetchEmails();
            }
            setLoading(false);
        };
        init();
    }, [checkConnection, fetchEmails]);

    const filteredEmails = emails.filter(email => {
        if (filter === 'all') return true;
        if (['HIGH', 'MEDIUM', 'LOW'].includes(filter)) {
            return email.analysis.priority === filter;
        }
        return email.analysis.action === filter;
    });

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <p className={styles.loadingText}>Checking connection...</p>
                </div>
            </div>
        );
    }

    if (!status.connected) {
        return (
            <div className={styles.container}>
                <div className={styles.connectCard}>
                    <svg className={styles.connectIcon} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                    </svg>
                    <h2 className={styles.connectTitle}>Connect Your Gmail</h2>
                    <p className={styles.connectDescription}>
                        Connect your Gmail account to analyze starred emails and get AI-powered insights
                        on which messages need your attention.
                    </p>
                    <a href="/api/email/auth" className={styles.connectButton}>
                        <svg className={styles.googleIcon} viewBox="0 0 24 24">
                            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Connect with Google
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerRow}>
                    <div>
                        <h1 className={styles.title}>Email Intelligence</h1>
                        <p className={styles.subtitle}>AI-powered analysis of your starred emails</p>
                    </div>
                    <div className={styles.headerRow}>
                        <div className={styles.connectedEmail}>
                            <span className={styles.connectedDot} />
                            {status.email}
                        </div>
                        <button
                            className={styles.refreshButton}
                            onClick={refresh}
                            disabled={refreshing}
                        >
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button className={styles.disconnectButton} onClick={disconnect}>
                            Disconnect
                        </button>
                    </div>
                </div>
            </header>

            {stats && (
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statValue}>{stats.total}</div>
                        <div className={styles.statLabel}>Total Starred</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${styles.high}`}>{stats.high}</div>
                        <div className={styles.statLabel}>High Priority</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${styles.medium}`}>{stats.medium}</div>
                        <div className={styles.statLabel}>Medium Priority</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${styles.low}`}>{stats.low}</div>
                        <div className={styles.statLabel}>Low Priority</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={`${styles.statValue} ${styles.response}`}>{stats.needsResponse}</div>
                        <div className={styles.statLabel}>Needs Response</div>
                    </div>
                </div>
            )}

            {/* Heatmap Visualization */}
            {emails.length > 0 && (
                <div className={styles.heatmapSection}>
                    <div className={styles.heatmapHeader}>
                        <h2 className={styles.sectionTitle}>Urgency Heatmap</h2>
                        <button
                            className={styles.toggleButton}
                            onClick={() => setShowHeatmap(!showHeatmap)}
                        >
                            {showHeatmap ? 'Hide' : 'Show'} Heatmap
                        </button>
                    </div>
                    {showHeatmap && (
                        <EmailHeatmap
                            emails={emails}
                            height={350}
                        />
                    )}
                </div>
            )}

            <div className={styles.filterBar}>
                <button
                    className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button
                    className={`${styles.filterButton} ${filter === 'HIGH' ? styles.active : ''}`}
                    onClick={() => setFilter('HIGH')}
                >
                    🔴 High Priority
                </button>
                <button
                    className={`${styles.filterButton} ${filter === 'MEDIUM' ? styles.active : ''}`}
                    onClick={() => setFilter('MEDIUM')}
                >
                    🟡 Medium
                </button>
                <button
                    className={`${styles.filterButton} ${filter === 'RESPONSE_NEEDED' ? styles.active : ''}`}
                    onClick={() => setFilter('RESPONSE_NEEDED')}
                >
                    ✉️ Needs Response
                </button>
                <button
                    className={`${styles.filterButton} ${filter === 'DEADLINE' ? styles.active : ''}`}
                    onClick={() => setFilter('DEADLINE')}
                >
                    ⏰ Has Deadline
                </button>
            </div>

            {filteredEmails.length === 0 ? (
                <div className={styles.emptyState}>
                    <svg className={styles.emptyIcon} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 6H4l8 5 8-5zm0 2l-8 5-8-5v10h16V8z" />
                    </svg>
                    <h3 className={styles.emptyTitle}>
                        {emails.length === 0 ? 'No starred emails' : 'No emails match this filter'}
                    </h3>
                    <p>
                        {emails.length === 0
                            ? 'Star some emails in Gmail to see them analyzed here.'
                            : 'Try a different filter to see more emails.'}
                    </p>
                </div>
            ) : (
                <div className={styles.emailGrid}>
                    {filteredEmails.map(email => (
                        <EmailCard key={email.id} email={email} />
                    ))}
                </div>
            )}
        </div>
    );
}
