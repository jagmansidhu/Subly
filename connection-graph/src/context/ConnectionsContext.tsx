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
    setDegreeFilter: (degrees: (1 | 2 | 3)[]) => void;
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
        degrees: [],
    });

    // Filtered connections
    const filteredConnections = useMemo(() => {
        return connections.filter(conn => {
            // Industry filter
            if (filters.industries.length > 0 && !filters.industries.includes(conn.industry)) {
                return false;
            }

            // Heat status filter
            if (filters.heatStatuses.length > 0 && !filters.heatStatuses.includes(conn.heatStatus)) {
                return false;
            }

            // Degree filter
            if (filters.degrees.length > 0 && !filters.degrees.includes(conn.degree)) {
                return false;
            }

            // Search query
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                const searchFields = [
                    conn.name,
                    conn.title,
                    conn.company,
                    conn.industry,
                ].map(f => f.toLowerCase());

                if (!searchFields.some(field => field.includes(query))) {
                    return false;
                }
            }

            return true;
        });
    }, [connections, filters]);

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

    const setDegreeFilter = useCallback((degrees: (1 | 2 | 3)[]) => {
        setFilters(prev => ({ ...prev, degrees }));
    }, []);

    const setSearchQuery = useCallback((searchQuery: string) => {
        setFilters(prev => ({ ...prev, searchQuery }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            industries: [],
            heatStatuses: [],
            searchQuery: '',
            degrees: [],
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
        setDegreeFilter,
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
