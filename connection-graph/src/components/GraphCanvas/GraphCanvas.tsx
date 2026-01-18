'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ConnectionNode, HeatStatus, ConnectionLink } from '@/types';
import { useConnections } from '@/context/ConnectionsContext';
import { getHeatColor } from '@/utils/heatMap';
import styles from './GraphCanvas.module.css';

interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    connection: ConnectionNode;
    targetRadius: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
    source: SimNode | string;
    target: SimNode | string;
}

// Neutral color for 2nd/3rd degree connections
const NEUTRAL_COLOR = '#6b7280'; // Gray

// Get target distance from center based on degree and heat (heat only for 1st degree)
function getTargetRadius(degree: 1 | 2 | 3, status: HeatStatus, maxRadius: number): number {
    // Base radius by degree
    const degreeRadius = {
        1: maxRadius * 0.25,  // 1st degree closest
        2: maxRadius * 0.55,  // 2nd degree middle
        3: maxRadius * 0.85,  // 3rd degree outer
    };

    // Only add heat-based variation for 1st degree connections
    if (degree === 1) {
        const heatOffset = {
            hot: -maxRadius * 0.05,
            warm: 0,
            cold: maxRadius * 0.05,
        };
        return degreeRadius[degree] + heatOffset[status];
    }

    return degreeRadius[degree];
}

// Get node color - heat colors only for 1st degree
function getNodeColor(degree: 1 | 2 | 3, heatStatus: HeatStatus): string {
    if (degree === 1) {
        return getHeatColor(heatStatus);
    }
    return NEUTRAL_COLOR;
}

// Get node size based on degree
function getNodeSize(degree: 1 | 2 | 3, baseRadius: number): number {
    switch (degree) {
        case 1: return baseRadius * 1.2;
        case 2: return baseRadius * 0.9;
        case 3: return baseRadius * 0.7;
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

    // D3 visualization with radial layout and links
    useEffect(() => {
        if (!svgRef.current || filteredConnections.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2 - 50;

        // Create nodes from connections with target radii
        const nodes: SimNode[] = filteredConnections.map((conn, i) => {
            const targetRadius = getTargetRadius(conn.degree, conn.heatStatus, maxRadius);
            const angle = (i / filteredConnections.length) * 2 * Math.PI;
            return {
                id: conn.id,
                connection: conn,
                targetRadius,
                x: centerX + Math.cos(angle) * (targetRadius + (Math.random() - 0.5) * 30),
                y: centerY + Math.sin(angle) * (targetRadius + (Math.random() - 0.5) * 30),
            };
        });

        // Create node lookup for links
        const nodeById = new Map(nodes.map(n => [n.id, n]));

        // Create links
        const simLinks: SimLink[] = links
            .filter(link => nodeById.has(link.source) && nodeById.has(link.target))
            .map(link => ({
                source: nodeById.get(link.source)!,
                target: nodeById.get(link.target)!,
            }));

        // Create glow filter
        const defs = svg.append('defs');

        ['hot', 'warm', 'cold'].forEach(status => {
            const filter = defs.append('filter')
                .attr('id', `glow-${status}`)
                .attr('x', '-50%')
                .attr('y', '-50%')
                .attr('width', '200%')
                .attr('height', '200%');

            filter.append('feGaussianBlur')
                .attr('stdDeviation', '3')
                .attr('result', 'coloredBlur');

            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        });

        // Draw ring zones (1st, 2nd, 3rd degree)
        const ringGroup = svg.append('g').attr('class', 'rings');

        [
            { radius: maxRadius * 0.4, label: '1st°', color: 'rgba(99, 102, 241, 0.15)' },
            { radius: maxRadius * 0.7, label: '2nd°', color: 'rgba(99, 102, 241, 0.10)' },
            { radius: maxRadius * 0.95, label: '3rd°', color: 'rgba(99, 102, 241, 0.05)' },
        ].forEach((ring, i) => {
            ringGroup.append('circle')
                .attr('cx', centerX)
                .attr('cy', centerY)
                .attr('r', ring.radius)
                .attr('fill', 'none')
                .attr('stroke', ring.color.replace(/[\d.]+\)$/, '0.3)'))
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '6,4');

            // Add degree labels
            ringGroup.append('text')
                .attr('x', centerX + ring.radius - 25)
                .attr('y', centerY - 5)
                .attr('fill', 'rgba(255,255,255,0.3)')
                .attr('font-size', '11px')
                .text(ring.label);
        });

        // Create zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 3])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
                ringGroup.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Container for nodes and links
        const container = svg.append('g');

        // Calculate base radius
        const baseRadius = Math.min(16, Math.max(8, 220 / Math.sqrt(nodes.length)));

        // Draw links FIRST (so they appear behind nodes)
        const linkGroup = container.append('g').attr('class', 'links');

        const linkElements = linkGroup.selectAll<SVGLineElement, SimLink>('line')
            .data(simLinks)
            .join('line')
            .attr('stroke', 'rgba(99, 102, 241, 0.3)')
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,2');

        // Custom radial force
        const radialForce = d3.forceRadial<SimNode>(
            d => d.targetRadius,
            centerX,
            centerY
        ).strength(0.6);

        // Force simulation with links
        const simulation = d3.forceSimulation(nodes)
            .force('radial', radialForce)
            .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
                .id(d => d.id)
                .distance(80)
                .strength(0.3))
            .force('collision', d3.forceCollide<SimNode>()
                .radius(d => getNodeSize(d.connection.degree, baseRadius) * 1.8)
                .strength(0.7))
            .force('charge', d3.forceManyBody()
                .strength(-40)
                .distanceMax(150));

        // Create node groups
        const nodeGroups = container.selectAll<SVGGElement, SimNode>('g.node')
            .data(nodes, d => d.id)
            .join('g')
            .attr('class', 'node')
            .style('cursor', 'pointer');

        // Add circles to nodes
        nodeGroups.append('circle')
            .attr('r', d => getNodeSize(d.connection.degree, baseRadius))
            .attr('fill', d => getNodeColor(d.connection.degree, d.connection.heatStatus))
            .attr('filter', d => d.connection.degree === 1 ? `url(#glow-${d.connection.heatStatus})` : 'none')
            .attr('stroke', d => selectedConnection?.id === d.id ? '#fff' : 'transparent')
            .attr('stroke-width', 2)
            .attr('opacity', d => d.connection.degree === 1 ? 1 : d.connection.degree === 2 ? 0.85 : 0.7)
            .style('transition', 'all 0.2s ease');

        // Add degree indicator ring for 2nd/3rd degree
        nodeGroups.filter(d => d.connection.degree > 1)
            .append('circle')
            .attr('r', d => getNodeSize(d.connection.degree, baseRadius) + 3)
            .attr('fill', 'none')
            .attr('stroke', d => d.connection.degree === 2 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', d => d.connection.degree === 2 ? '3,2' : '2,3');

        // Add initials text
        nodeGroups.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#fff')
            .attr('font-size', d => getNodeSize(d.connection.degree, baseRadius) * 0.65)
            .attr('font-weight', '600')
            .attr('pointer-events', 'none')
            .text(d => {
                const names = d.connection.name.split(' ');
                return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
            });

        // Add hover tooltips
        nodeGroups.append('title')
            .text(d => `${d.connection.name}\n${d.connection.title}\n${d.connection.company}\n(${d.connection.degree}° connection)`);

        // Click handler
        nodeGroups.on('click', (event, d) => {
            event.stopPropagation();
            selectConnection(d.connection);
        });

        // Hover effects
        nodeGroups
            .on('mouseenter', function (event, d) {
                const size = getNodeSize(d.connection.degree, baseRadius);
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', size * 1.25);

                // Highlight connected links
                linkElements
                    .attr('stroke', link => {
                        const source = link.source as SimNode;
                        const target = link.target as SimNode;
                        if (source.id === d.id || target.id === d.id) {
                            return 'rgba(99, 102, 241, 0.8)';
                        }
                        return 'rgba(99, 102, 241, 0.2)';
                    })
                    .attr('stroke-width', link => {
                        const source = link.source as SimNode;
                        const target = link.target as SimNode;
                        return (source.id === d.id || target.id === d.id) ? 2.5 : 1;
                    });
            })
            .on('mouseleave', function (event, d) {
                const size = getNodeSize(d.connection.degree, baseRadius);
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', size);

                // Reset links
                linkElements
                    .attr('stroke', 'rgba(99, 102, 241, 0.3)')
                    .attr('stroke-width', 1.5);
            });

        // Drag behavior
        const drag = d3.drag<SVGGElement, SimNode>()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
            });

        nodeGroups.call(drag);

        // Click on background to deselect
        svg.on('click', () => {
            selectConnection(null);
        });

        // Update positions on tick
        simulation.on('tick', () => {
            // Update link positions
            linkElements
                .attr('x1', d => (d.source as SimNode).x!)
                .attr('y1', d => (d.source as SimNode).y!)
                .attr('x2', d => (d.target as SimNode).x!)
                .attr('y2', d => (d.target as SimNode).y!);

            // Update node positions
            nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Cleanup
        return () => {
            simulation.stop();
        };
    }, [filteredConnections, links, dimensions, selectConnection, selectedConnection]);

    // Update selected node appearance
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll<SVGCircleElement, SimNode>('g.node > circle:first-child')
            .attr('stroke', (d) => {
                return selectedConnection?.id === d?.id ? '#fff' : 'transparent';
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
