'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Connection, ConnectionNode, ConnectionLink, FilterState, HeatStatus } from '@/types';
import { mockConnections } from '@/data/mockConnections';
import { getHeatStatus } from '@/utils/heatMap';

interface ConnectionsContextType {
    // Data
    connections: ConnectionNode[];
    filteredConnections: ConnectionNode[];
    links: ConnectionLink[];
    selectedConnection: ConnectionNode | null;

    // Filters
    filters: FilterState;
    setIndustryFilter: (industries: string[]) => void;
    setHeatFilter: (statuses: HeatStatus[]) => void;
    setSearchQuery: (query: string) => void;
    setMaxDegreeFilter: (maxDegree: 1 | 2 | 3 | null) => void;
    clearFilters: () => void;

    // Selection
    selectConnection: (connection: ConnectionNode | null) => void;

    // Add connections (for LinkedIn import)
    addConnections: (newConnections: Connection[]) => void;
    clearAllConnections: () => void;

    // Stats
    stats: {
        total: number;
        hot: number;
        warm: number;
        cold: number;
        industries: string[];
        degree1: number;
        degree2: number;
        degree3: number;
    };
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
    // Raw connections state (can be updated via import)
    const [rawConnections, setRawConnections] = useState<Connection[]>(mockConnections);

    // Transform raw connections into nodes with heat status
    const connections: ConnectionNode[] = useMemo(() => {
        return rawConnections.map(conn => ({
            ...conn,
            heatStatus: getHeatStatus(conn.lastContactDate),
        }));
    }, [rawConnections]);

    // Generate links from connectedThrough relationships
    const allLinks: ConnectionLink[] = useMemo(() => {
        return connections
            .filter(conn => conn.connectedThrough)
            .map(conn => ({
                source: conn.connectedThrough!,
                target: conn.id,
            }));
    }, [connections]);

    // State
    const [selectedConnection, setSelectedConnection] = useState<ConnectionNode | null>(null);
    const [filters, setFilters] = useState<FilterState>({
        industries: [],
        heatStatuses: [],
        searchQuery: '',
        maxDegree: null, // null = show all
    });

    // Helper: check if connection matches basic filters (industry, search)
    const matchesBasicFilters = useCallback((conn: ConnectionNode) => {
        // Industry filter
        if (filters.industries.length > 0 && !filters.industries.includes(conn.industry)) {
            return false;
        }
        // Search query
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            const searchFields = [conn.name, conn.title, conn.company, conn.industry].map(f => f.toLowerCase());
            if (!searchFields.some(field => field.includes(query))) {
                return false;
            }
        }
        return true;
    }, [filters.industries, filters.searchQuery]);

    // Filtered connections with cascading logic based on maxDegree
    // When selecting a degree, show that degree AND all parent degrees needed
    const filteredConnections = useMemo(() => {
        const { maxDegree, heatStatuses } = filters;

        // First pass: filter 1st degree connections (always needed as base)
        const firstDegreeFiltered = connections.filter(conn => {
            if (conn.degree !== 1) return false;
            if (!matchesBasicFilters(conn)) return false;

            // Heat status filter (only for 1st degree)
            if (heatStatuses.length > 0 && !heatStatuses.includes(conn.heatStatus)) {
                return false;
            }

            return true;
        });

        // If maxDegree is 1, only show 1st degree
        if (maxDegree === 1) {
            return firstDegreeFiltered;
        }

        const visible1stIds = new Set(firstDegreeFiltered.map(c => c.id));

        // Second pass: 2nd degree - only those connected to visible 1st degree
        const secondDegreeFiltered = connections.filter(conn => {
            if (conn.degree !== 2) return false;
            if (!conn.connectedThrough || !visible1stIds.has(conn.connectedThrough)) return false;
            if (!matchesBasicFilters(conn)) return false;
            return true;
        });

        // If maxDegree is 2, show 1st + 2nd degree
        if (maxDegree === 2) {
            return [...firstDegreeFiltered, ...secondDegreeFiltered];
        }

        const visible2ndIds = new Set(secondDegreeFiltered.map(c => c.id));

        // Third pass: 3rd degree - only those connected to visible 2nd degree
        const thirdDegreeFiltered = connections.filter(conn => {
            if (conn.degree !== 3) return false;
            if (!conn.connectedThrough || !visible2ndIds.has(conn.connectedThrough)) return false;
            if (!matchesBasicFilters(conn)) return false;
            return true;
        });

        // maxDegree is 3 or null - show all
        return [...firstDegreeFiltered, ...secondDegreeFiltered, ...thirdDegreeFiltered];
    }, [connections, filters, matchesBasicFilters]);

    // Filter links to only include visible connections
    const links: ConnectionLink[] = useMemo(() => {
        const visibleIds = new Set(filteredConnections.map(c => c.id));
        return allLinks.filter(link =>
            visibleIds.has(link.source) && visibleIds.has(link.target)
        );
    }, [allLinks, filteredConnections]);

    // Stats
    const stats = useMemo(() => {
        const industriesSet = new Set(connections.map(c => c.industry));
        return {
            total: connections.length,
            hot: connections.filter(c => c.heatStatus === 'hot').length,
            warm: connections.filter(c => c.heatStatus === 'warm').length,
            cold: connections.filter(c => c.heatStatus === 'cold').length,
            industries: Array.from(industriesSet).sort(),
            degree1: connections.filter(c => c.degree === 1).length,
            degree2: connections.filter(c => c.degree === 2).length,
            degree3: connections.filter(c => c.degree === 3).length,
        };
    }, [connections]);

    // Actions
    const setIndustryFilter = useCallback((industries: string[]) => {
        setFilters(prev => ({ ...prev, industries }));
    }, []);

    const setHeatFilter = useCallback((heatStatuses: HeatStatus[]) => {
        setFilters(prev => ({ ...prev, heatStatuses }));
    }, []);

    const setMaxDegreeFilter = useCallback((maxDegree: 1 | 2 | 3 | null) => {
        setFilters(prev => ({ ...prev, maxDegree }));
    }, []);

    const setSearchQuery = useCallback((searchQuery: string) => {
        setFilters(prev => ({ ...prev, searchQuery }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            industries: [],
            heatStatuses: [],
            searchQuery: '',
            maxDegree: null,
        });
    }, []);

    const selectConnection = useCallback((connection: ConnectionNode | null) => {
        setSelectedConnection(connection);
    }, []);

    // Add new connections (from LinkedIn import)
    const addConnections = useCallback((newConnections: Connection[]) => {
        setRawConnections(prev => [...prev, ...newConnections]);
    }, []);

    // Clear all connections
    const clearAllConnections = useCallback(() => {
        setRawConnections([]);
        setSelectedConnection(null);
    }, []);

    const value: ConnectionsContextType = {
        connections,
        filteredConnections,
        links,
        selectedConnection,
        filters,
        setIndustryFilter,
        setHeatFilter,
        setMaxDegreeFilter,
        setSearchQuery,
        clearFilters,
        selectConnection,
        addConnections,
        clearAllConnections,
        stats,
    };

    return (
        <ConnectionsContext.Provider value={value}>
            {children}
        </ConnectionsContext.Provider>
    );
}

export function useConnections() {
    const context = useContext(ConnectionsContext);
    if (context === undefined) {
        throw new Error('useConnections must be used within a ConnectionsProvider');
    }
    return context;
}
