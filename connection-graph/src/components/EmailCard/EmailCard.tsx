'use client';

import { useState } from 'react';
import styles from './EmailCard.module.css';
import type { AnalyzedEmail } from '@/lib/gemini';

interface EmailCardProps {
    email: AnalyzedEmail;
    onOpen?: () => void;
}

export function EmailCard({ email, onOpen }: EmailCardProps) {
    const [expanded, setExpanded] = useState(false);
    const { analysis } = email;

    const formatDate = (date: Date) => {
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getResponseTimeClass = () => {
        switch (analysis.suggestedResponseTime) {
            case 'ASAP': return styles.urgent;
            case 'This week': return styles.thisWeek;
            default: return styles.convenient;
        }
    };

    const handleClick = () => {
        setExpanded(!expanded);
        if (onOpen) onOpen();
    };

    return (
        <article
            className={`${styles.emailCard} ${styles[analysis.priority.toLowerCase()]} ${expanded ? styles.expanded : ''}`}
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
            <div className={styles.header}>
                <div className={styles.senderInfo}>
                    <p className={styles.sender}>{email.from}</p>
                    <p className={styles.email}>{email.fromEmail}</p>
                </div>
                <div className={styles.badges}>
                    <span className={`${styles.priorityBadge} ${styles[analysis.priority.toLowerCase()]}`}>
                        {analysis.priority}
                    </span>
                    <span className={styles.actionBadge}>
                        {analysis.action.replace('_', ' ')}
                    </span>
                </div>
            </div>

            <h3 className={styles.subject}>{email.subject}</h3>

            <p className={styles.summary}>
                {analysis.summary}
            </p>

            {expanded && analysis.keyPoints && analysis.keyPoints.length > 0 && (
                <ul className={styles.keyPoints}>
                    {analysis.keyPoints.map((point, idx) => (
                        <li key={idx}>{point}</li>
                    ))}
                </ul>
            )}

            {analysis.deadline && (
                <div className={styles.deadline}>
                    <svg className={styles.deadlineIcon} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zm-1-13v6l5.25 3.15.75-1.23-4.5-2.67V7h-1.5z" />
                    </svg>
                    <span>Deadline: {analysis.deadline}</span>
                </div>
            )}

            <div className={styles.footer}>
                <span className={styles.date}>{formatDate(email.date)}</span>
                <span className={`${styles.responseTime} ${getResponseTimeClass()}`}>
                    {analysis.suggestedResponseTime}
                </span>
            </div>
        </article>
    );
}
