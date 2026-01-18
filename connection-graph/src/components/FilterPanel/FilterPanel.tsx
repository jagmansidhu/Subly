'use client';

import React from 'react';
import { useConnections } from '@/context/ConnectionsContext';
import { HeatStatus } from '@/types';
import { getHeatColor, getHeatLabel } from '@/utils/heatMap';
import styles from './FilterPanel.module.css';

export default function FilterPanel() {
    const {
        filters,
        setIndustryFilter,
        setHeatFilter,
        setSearchQuery,
        clearFilters,
        stats,
    } = useConnections();

    const handleIndustryChange = (industry: string) => {
        const newIndustries = filters.industries.includes(industry)
            ? filters.industries.filter(i => i !== industry)
            : [...filters.industries, industry];
        setIndustryFilter(newIndustries);
    };

    const handleHeatChange = (status: HeatStatus) => {
        const newStatuses = filters.heatStatuses.includes(status)
            ? filters.heatStatuses.filter(s => s !== status)
            : [...filters.heatStatuses, status];
        setHeatFilter(newStatuses);
    };

    const hasActiveFilters =
        filters.industries.length > 0 ||
        filters.heatStatuses.length > 0 ||
        filters.searchQuery.length > 0;

    return (
        <aside className={styles.panel}>
            <div className={styles.header}>
                <h2>Filters</h2>
                {hasActiveFilters && (
                    <button onClick={clearFilters} className={styles.clearBtn}>
                        Clear all
                    </button>
                )}
            </div>

            {/* Search */}
            <div className={styles.section}>
                <label className={styles.sectionTitle}>Search</label>
                <input
                    type="text"
                    placeholder="Search by name, company..."
                    value={filters.searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />
            </div>

            {/* Heat Status Filter */}
            <div className={styles.section}>
                <label className={styles.sectionTitle}>Engagement Status</label>
                <div className={styles.heatFilters}>
                    {(['hot', 'warm', 'cold'] as HeatStatus[]).map(status => (
                        <label key={status} className={styles.heatOption}>
                            <input
                                type="checkbox"
                                checked={filters.heatStatuses.includes(status)}
                                onChange={() => handleHeatChange(status)}
                            />
                            <span
                                className={styles.heatBadge}
                                style={{
                                    backgroundColor: getHeatColor(status),
                                    opacity: filters.heatStatuses.length === 0 || filters.heatStatuses.includes(status) ? 1 : 0.4
                                }}
                            >
                                {status === 'hot' && `🔥 Hot (${stats.hot})`}
                                {status === 'warm' && `🟡 Warm (${stats.warm})`}
                                {status === 'cold' && `🔵 Cold (${stats.cold})`}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Industry Filter */}
            <div className={styles.section}>
                <label className={styles.sectionTitle}>Industry</label>
                <div className={styles.industryFilters}>
                    {stats.industries.map(industry => (
                        <label key={industry} className={styles.industryOption}>
                            <input
                                type="checkbox"
                                checked={filters.industries.includes(industry)}
                                onChange={() => handleIndustryChange(industry)}
                            />
                            <span className={`${styles.industryTag} ${filters.industries.includes(industry) ? styles.active : ''}`}>
                                {industry}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className={styles.stats}>
                <p className={styles.statLabel}>Total Connections</p>
                <p className={styles.statValue}>{stats.total}</p>
            </div>
        </aside>
    );
}
