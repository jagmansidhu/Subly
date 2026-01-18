'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Connection, ConnectionNode, FilterState, HeatStatus, INDUSTRIES } from '@/types';
import { mockConnections } from '@/data/mockConnections';
import { getHeatStatus } from '@/utils/heatMap';

interface ConnectionsContextType {
    // Data
    connections: ConnectionNode[];
    filteredConnections: ConnectionNode[];
    selectedConnection: ConnectionNode | null;

    // Filters
    filters: FilterState;
    setIndustryFilter: (industries: string[]) => void;
    setHeatFilter: (statuses: HeatStatus[]) => void;
    setSearchQuery: (query: string) => void;
    clearFilters: () => void;

    // Selection
    selectConnection: (connection: ConnectionNode | null) => void;

    // Stats
    stats: {
        total: number;
        hot: number;
        warm: number;
        cold: number;
        industries: string[];
    };
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: React.ReactNode }) {
    // Transform raw connections into nodes with heat status
    const connections: ConnectionNode[] = useMemo(() => {
        return mockConnections.map(conn => ({
            ...conn,
            heatStatus: getHeatStatus(conn.lastContactDate),
        }));
    }, []);

    // State
    const [selectedConnection, setSelectedConnection] = useState<ConnectionNode | null>(null);
    const [filters, setFilters] = useState<FilterState>({
        industries: [],
        heatStatuses: [],
        searchQuery: '',
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

    // Stats
    const stats = useMemo(() => {
        const industriesSet = new Set(connections.map(c => c.industry));
        return {
            total: connections.length,
            hot: connections.filter(c => c.heatStatus === 'hot').length,
            warm: connections.filter(c => c.heatStatus === 'warm').length,
            cold: connections.filter(c => c.heatStatus === 'cold').length,
            industries: Array.from(industriesSet).sort(),
        };
    }, [connections]);

    // Actions
    const setIndustryFilter = useCallback((industries: string[]) => {
        setFilters(prev => ({ ...prev, industries }));
    }, []);

    const setHeatFilter = useCallback((heatStatuses: HeatStatus[]) => {
        setFilters(prev => ({ ...prev, heatStatuses }));
    }, []);

    const setSearchQuery = useCallback((searchQuery: string) => {
        setFilters(prev => ({ ...prev, searchQuery }));
    }, []);

    const clearFilters = useCallback(() => {
        setFilters({
            industries: [],
            heatStatuses: [],
            searchQuery: '',
        });
    }, []);

    const selectConnection = useCallback((connection: ConnectionNode | null) => {
        setSelectedConnection(connection);
    }, []);

    const value: ConnectionsContextType = {
        connections,
        filteredConnections,
        selectedConnection,
        filters,
        setIndustryFilter,
        setHeatFilter,
        setSearchQuery,
        clearFilters,
        selectConnection,
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
