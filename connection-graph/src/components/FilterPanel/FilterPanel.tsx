'use client';

import React from 'react';
import { useConnections } from '@/context/ConnectionsContext';
import { HeatStatus } from '@/types';
import { getHeatColor } from '@/utils/heatMap';
import LinkedInImport from '@/components/LinkedInImport';
import styles from './FilterPanel.module.css';

export default function FilterPanel() {
    const {
        filters,
        setIndustryFilter,
        setHeatFilter,
        setDegreeFilter,
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

    const handleDegreeChange = (degree: 1 | 2 | 3) => {
        const newDegrees = filters.degrees.includes(degree)
            ? filters.degrees.filter(d => d !== degree)
            : [...filters.degrees, degree];
        setDegreeFilter(newDegrees);
    };

    const hasActiveFilters =
        filters.industries.length > 0 ||
        filters.heatStatuses.length > 0 ||
        filters.degrees.length > 0 ||
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

            {/* Connection Degree Filter */}
            <div className={styles.section}>
                <label className={styles.sectionTitle}>Connection Degree</label>
                <div className={styles.degreeFilters}>
                    {([1, 2, 3] as const).map(degree => (
                        <label key={degree} className={styles.degreeOption}>
                            <input
                                type="checkbox"
                                checked={filters.degrees.includes(degree)}
                                onChange={() => handleDegreeChange(degree)}
                            />
                            <span className={`${styles.degreeBadge} ${filters.degrees.includes(degree) ? styles.active : ''}`}>
                                {degree === 1 && `1st° (${stats.degree1})`}
                                {degree === 2 && `2nd° (${stats.degree2})`}
                                {degree === 3 && `3rd° (${stats.degree3})`}
                            </span>
                        </label>
                    ))}
                </div>
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

            {/* LinkedIn Import */}
            <div className={styles.section}>
                <label className={styles.sectionTitle}>Import Data</label>
                <LinkedInImport />
            </div>

            {/* Stats */}
            <div className={styles.stats}>
                <p className={styles.statLabel}>Total Connections</p>
                <p className={styles.statValue}>{stats.total}</p>
            </div>
        </aside>
    );
}
