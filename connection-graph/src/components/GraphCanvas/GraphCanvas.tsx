'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ConnectionNode, HeatStatus } from '@/types';
import { useConnections } from '@/context/ConnectionsContext';
import { getHeatColor } from '@/utils/heatMap';
import styles from './GraphCanvas.module.css';

// Extended SimNode to include special "user" node
interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    isUser?: boolean;
    connection?: ConnectionNode;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    source: SimNode | string;
    target: SimNode | string;
}

// Colors
const USER_COLOR = '#a855f7'; // Purple for user
const NEUTRAL_COLOR = '#6b7280'; // Gray for 2nd/3rd degree

// Get node color based on type
function getNodeColor(node: SimNode): string {
    if (node.isUser) return USER_COLOR;
    if (!node.connection) return NEUTRAL_COLOR;

    if (node.connection.degree === 1) {
        return getHeatColor(node.connection.heatStatus);
    }
    return NEUTRAL_COLOR;
}

// Get node size based on type and degree
function getNodeSize(node: SimNode, baseRadius: number): number {
    if (node.isUser) return baseRadius * 1.8; // User is largest
    if (!node.connection) return baseRadius;

    switch (node.connection.degree) {
        case 1: return baseRadius * 1.1;
        case 2: return baseRadius * 0.85;
        case 3: return baseRadius * 0.65;
    }
}

export default function GraphCanvas() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { filteredConnections, links, selectConnection, selectedConnection } = useConnections();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    // Handle resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDimensions({ width, height });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, []);

    // D3 Obsidian-style force-directed graph
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const centerX = width / 2;
        const centerY = height / 2;

        // Create USER node (center)
        const userNode: SimNode = {
            id: 'USER',
            isUser: true,
            x: centerX,
            y: centerY,
            fx: centerX, // Fixed position at center
            fy: centerY,
        };

        // Create connection nodes
        const connectionNodes: SimNode[] = filteredConnections.map((conn, i) => ({
            id: conn.id,
            connection: conn,
            x: centerX + (Math.random() - 0.5) * 300,
            y: centerY + (Math.random() - 0.5) * 300,
        }));

        // All nodes including user
        const nodes: SimNode[] = [userNode, ...connectionNodes];
        const nodeById = new Map(nodes.map(n => [n.id, n]));

        // Create links: User -> 1st degree, existing links for 2nd/3rd
        const simLinks: SimLink[] = [];

        // Connect all 1st degree to user
        connectionNodes.forEach(node => {
            if (node.connection?.degree === 1) {
                simLinks.push({
                    source: userNode,
                    target: node,
                });
            }
        });

        // Add existing relationship links (2nd -> 1st, 3rd -> 2nd)
        links.forEach(link => {
            const source = nodeById.get(link.source);
            const target = nodeById.get(link.target);
            if (source && target) {
                simLinks.push({ source, target });
            }
        });

        // Create defs for filters
        const defs = svg.append('defs');

        // Glow filters
        ['hot', 'warm', 'cold', 'user'].forEach(status => {
            const filter = defs.append('filter')
                .attr('id', `glow-${status}`)
                .attr('x', '-50%')
                .attr('y', '-50%')
                .attr('width', '200%')
                .attr('height', '200%');

            filter.append('feGaussianBlur')
                .attr('stdDeviation', status === 'user' ? '6' : '3')
                .attr('result', 'coloredBlur');

            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        });

        // Create zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Container for everything
        const container = svg.append('g');

        // Calculate base radius
        const baseRadius = Math.min(14, Math.max(8, 180 / Math.sqrt(nodes.length)));

        // Draw links FIRST
        const linkElements = container.append('g')
            .attr('class', 'links')
            .selectAll<SVGLineElement, SimLink>('line')
            .data(simLinks)
            .join('line')
            .attr('stroke', d => {
                const source = d.source as SimNode;
                if (source.isUser) return 'rgba(168, 85, 247, 0.4)'; // Purple for user links
                return 'rgba(99, 102, 241, 0.25)';
            })
            .attr('stroke-width', d => {
                const source = d.source as SimNode;
                return source.isUser ? 1.5 : 1;
            });

        // Obsidian-style force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
                .id(d => d.id)
                .distance(d => {
                    const source = d.source as SimNode;
                    const target = d.target as SimNode;
                    if (source.isUser) {
                        // Distance from user based on heat
                        const heat = target.connection?.heatStatus;
                        if (heat === 'hot') return 80;
                        if (heat === 'warm') return 120;
                        return 160;
                    }
                    return 100;
                })
                .strength(0.5))
            .force('charge', d3.forceManyBody()
                .strength(d => (d as SimNode).isUser ? -300 : -80)
                .distanceMax(400))
            .force('collision', d3.forceCollide<SimNode>()
                .radius(d => getNodeSize(d, baseRadius) * 2)
                .strength(0.6))
            .force('center', d3.forceCenter(centerX, centerY).strength(0.05));

        // Create node groups
        const nodeGroups = container.selectAll<SVGGElement, SimNode>('g.node')
            .data(nodes, d => d.id)
            .join('g')
            .attr('class', 'node')
            .style('cursor', d => d.isUser ? 'default' : 'pointer');

        // Add circles
        nodeGroups.append('circle')
            .attr('r', d => getNodeSize(d, baseRadius))
            .attr('fill', d => getNodeColor(d))
            .attr('filter', d => {
                if (d.isUser) return 'url(#glow-user)';
                if (d.connection?.degree === 1) {
                    return `url(#glow-${d.connection.heatStatus})`;
                }
                return 'none';
            })
            .attr('stroke', d => {
                if (d.isUser) return 'rgba(255,255,255,0.5)';
                if (selectedConnection?.id === d.id) return '#fff';
                return 'transparent';
            })
            .attr('stroke-width', d => d.isUser ? 3 : 2)
            .attr('opacity', d => {
                if (d.isUser) return 1;
                if (d.connection?.degree === 1) return 1;
                if (d.connection?.degree === 2) return 0.85;
                return 0.7;
            })
            .style('transition', 'all 0.15s ease');

        // Add labels
        nodeGroups.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#fff')
            .attr('font-size', d => d.isUser ? baseRadius * 0.9 : getNodeSize(d, baseRadius) * 0.6)
            .attr('font-weight', d => d.isUser ? '700' : '600')
            .attr('pointer-events', 'none')
            .text(d => {
                if (d.isUser) return 'YOU';
                const names = d.connection!.name.split(' ');
                return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
            });

        // Add tooltips
        nodeGroups.filter(d => !d.isUser)
            .append('title')
            .text(d => `${d.connection!.name}\n${d.connection!.title}\n${d.connection!.company}\n(${d.connection!.degree}° connection)`);

        // Click handler
        nodeGroups.on('click', (event, d) => {
            if (d.isUser) return;
            event.stopPropagation();
            selectConnection(d.connection!);
        });

        // Hover effects
        nodeGroups
            .on('mouseenter', function (event, d) {
                if (d.isUser) return;

                const size = getNodeSize(d, baseRadius);
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', size * 1.3);

                // Highlight connected links
                linkElements
                    .attr('stroke-opacity', link => {
                        const source = link.source as SimNode;
                        const target = link.target as SimNode;
                        return (source.id === d.id || target.id === d.id) ? 1 : 0.3;
                    })
                    .attr('stroke-width', link => {
                        const source = link.source as SimNode;
                        const target = link.target as SimNode;
                        return (source.id === d.id || target.id === d.id) ? 2.5 : 1;
                    });
            })
            .on('mouseleave', function (event, d) {
                if (d.isUser) return;

                const size = getNodeSize(d, baseRadius);
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', size);

                // Reset links
                linkElements
                    .attr('stroke-opacity', 1)
                    .attr('stroke-width', link => {
                        const source = link.source as SimNode;
                        return source.isUser ? 1.5 : 1;
                    });
            });

        // Drag behavior (not for user node)
        const drag = d3.drag<SVGGElement, SimNode>()
            .on('start', (event, d) => {
                if (d.isUser) return;
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                if (d.isUser) return;
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (d.isUser) return;
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });

        nodeGroups.call(drag);

        // Click background to deselect
        svg.on('click', () => {
            selectConnection(null);
        });

        // Update on tick
        simulation.on('tick', () => {
            linkElements
                .attr('x1', d => (d.source as SimNode).x!)
                .attr('y1', d => (d.source as SimNode).y!)
                .attr('x2', d => (d.target as SimNode).x!)
                .attr('y2', d => (d.target as SimNode).y!);

            nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        return () => {
            simulation.stop();
        };
    }, [filteredConnections, links, dimensions, selectConnection, selectedConnection]);

    // Update selection highlight
    useEffect(() => {
        if (!svgRef.current) return;

        d3.select(svgRef.current)
            .selectAll<SVGCircleElement, SimNode>('g.node circle')
            .attr('stroke', d => {
                if (d?.isUser) return 'rgba(255,255,255,0.5)';
                if (selectedConnection?.id === d?.id) return '#fff';
                return 'transparent';
            });
    }, [selectedConnection]);

    return (
        <div ref={containerRef} className={styles.container}>
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                className={styles.svg}
            />
            {filteredConnections.length === 0 && (
                <div className={styles.emptyState}>
                    <p>No connections match your filters</p>
                </div>
            )}
        </div>
    );
}
