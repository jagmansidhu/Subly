'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ConnectionNode } from '@/types';
import { useConnections } from '@/context/ConnectionsContext';
import { getHeatColor, getHeatGlowColor } from '@/utils/heatMap';
import styles from './GraphCanvas.module.css';

interface SimNode extends d3.SimulationNodeDatum {
    id: string;
    connection: ConnectionNode;
}

export default function GraphCanvas() {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { filteredConnections, selectConnection, selectedConnection } = useConnections();
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

    // D3 visualization
    useEffect(() => {
        if (!svgRef.current || filteredConnections.length === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const centerX = width / 2;
        const centerY = height / 2;

        // Create nodes from connections
        const nodes: SimNode[] = filteredConnections.map((conn, i) => ({
            id: conn.id,
            connection: conn,
            x: centerX + (Math.random() - 0.5) * 200,
            y: centerY + (Math.random() - 0.5) * 200,
        }));

        // Create glow filter
        const defs = svg.append('defs');

        // Create glow filters for each heat status
        ['hot', 'warm', 'cold'].forEach(status => {
            const filter = defs.append('filter')
                .attr('id', `glow-${status}`)
                .attr('x', '-50%')
                .attr('y', '-50%')
                .attr('width', '200%')
                .attr('height', '200%');

            filter.append('feGaussianBlur')
                .attr('stdDeviation', '4')
                .attr('result', 'coloredBlur');

            const feMerge = filter.append('feMerge');
            feMerge.append('feMergeNode').attr('in', 'coloredBlur');
            feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        });

        // Create zoom behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 3])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Container for all elements (for zoom/pan)
        const container = svg.append('g');

        // Calculate base radius based on number of connections
        const baseRadius = Math.min(20, Math.max(10, 300 / Math.sqrt(nodes.length)));

        // Force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('charge', d3.forceManyBody()
                .strength(-150)
                .distanceMax(300))
            .force('center', d3.forceCenter(centerX, centerY))
            .force('collision', d3.forceCollide()
                .radius(baseRadius * 2.5)
                .strength(0.8))
            .force('x', d3.forceX(centerX).strength(0.05))
            .force('y', d3.forceY(centerY).strength(0.05));

        // Create node groups
        const nodeGroups = container.selectAll<SVGGElement, SimNode>('g.node')
            .data(nodes, d => d.id)
            .join('g')
            .attr('class', 'node')
            .style('cursor', 'pointer');

        // Add circles to nodes
        nodeGroups.append('circle')
            .attr('r', baseRadius)
            .attr('fill', d => getHeatColor(d.connection.heatStatus))
            .attr('filter', d => `url(#glow-${d.connection.heatStatus})`)
            .attr('stroke', d => selectedConnection?.id === d.id ? '#fff' : 'transparent')
            .attr('stroke-width', 3)
            .style('transition', 'all 0.2s ease');

        // Add initials text
        nodeGroups.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', '#fff')
            .attr('font-size', baseRadius * 0.7)
            .attr('font-weight', '600')
            .attr('pointer-events', 'none')
            .text(d => {
                const names = d.connection.name.split(' ');
                return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
            });

        // Add hover tooltips
        nodeGroups.append('title')
            .text(d => `${d.connection.name}\n${d.connection.title}\n${d.connection.company}`);

        // Click handler
        nodeGroups.on('click', (event, d) => {
            event.stopPropagation();
            selectConnection(d.connection);
        });

        // Hover effects
        nodeGroups
            .on('mouseenter', function (event, d) {
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', baseRadius * 1.3);
            })
            .on('mouseleave', function (event, d) {
                d3.select(this).select('circle')
                    .transition()
                    .duration(200)
                    .attr('r', baseRadius);
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
            nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        });

        // Cleanup
        return () => {
            simulation.stop();
        };
    }, [filteredConnections, dimensions, selectConnection, selectedConnection]);

    // Update selected node appearance
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('circle')
            .attr('stroke', function () {
                const parent = d3.select(this.parentNode as Element);
                const data = parent.datum() as SimNode;
                return selectedConnection?.id === data?.id ? '#fff' : 'transparent';
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
