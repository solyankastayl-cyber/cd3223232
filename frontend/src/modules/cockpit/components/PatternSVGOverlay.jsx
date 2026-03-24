/**
 * PatternSVGOverlay.jsx (V3 — Full Projection Support)
 * 
 * SVG layer поверх lightweight-charts для полной отрисовки паттернов:
 * 
 * 4 СЛОЯ ОТРИСОВКИ:
 * 1. STRUCTURE — сама фигура (points, lines, fill)
 * 2. BOUNDS — границы/уровни (resistance, support, neckline)
 * 3. COMPLETION — завершение фигуры (apex, confirm level)
 * 4. PROJECTION — сценарии движения (target up/down, arrows)
 * 
 * Поддерживаемые паттерны:
 * - Double Top/Bottom
 * - Triangle (symmetrical, ascending, descending)
 * - Wedge (falling, rising)
 * - Range/Channel
 */

import React, { useEffect, useState, useCallback } from 'react';

const PatternSVGOverlay = ({ chart, priceSeries, pattern, renderContract }) => {
  const [svgData, setSvgData] = useState(null);
  
  // ═══════════════════════════════════════════════════════════════
  // COORDINATE CONVERSION
  // ═══════════════════════════════════════════════════════════════
  
  const calculateCoordinates = useCallback(() => {
    if (!chart || !renderContract || !priceSeries) return null;
    
    try {
      const timeScale = chart.timeScale();
      
      if (!timeScale) {
        console.warn('[PatternSVGOverlay] Missing timeScale');
        return null;
      }
      
      // Helper: convert time to X coordinate
      const toX = (time) => {
        const t = time > 1e12 ? Math.floor(time / 1000) : time;
        const x = timeScale.timeToCoordinate(t);
        return x !== null ? x : null;
      };
      
      // Helper: convert price to Y coordinate
      const toY = (price) => {
        try {
          const y = priceSeries.priceToCoordinate(price);
          return y !== null ? y : null;
        } catch (e) {
          return null;
        }
      };
      
      // Helper: convert point {time, price} to {x, y}
      const toXY = (p) => {
        if (!p) return null;
        const x = toX(p.time);
        const y = toY(p.price);
        if (x === null || y === null) return null;
        return { x, y };
      };
      
      const patternType = renderContract.type;
      const mode = renderContract.mode || 'strict';
      const bias = renderContract.bias || 'neutral';
      
      // Get projection contract if available
      const projection = renderContract.projection_contract || renderContract.projection || null;
      
      // Colors
      const bearishColor = '#ef4444';
      const bullishColor = '#22c55e';
      const neutralColor = '#3b82f6';
      const projectionColor = '#00bfff';
      const invalidationColor = '#fbbf24';
      
      const mainColor = bias === 'bullish' ? bullishColor : 
                       bias === 'bearish' ? bearishColor : 
                       neutralColor;
      
      const strokeWidth = mode === 'loose' ? 1.5 : 2.5;
      const strokeDash = mode === 'loose' ? '4 4' : 'none';
      
      // ═══════════════════════════════════════════════════════════════
      // DOUBLE TOP / DOUBLE BOTTOM
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        return buildDoubleTopSVG(renderContract, projection, toX, toY, toXY, mainColor, strokeWidth, projectionColor, invalidationColor);
      }
      
      // ═══════════════════════════════════════════════════════════════
      // TRIANGLE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('triangle')) {
        return buildTriangleSVG(renderContract, projection, toX, toY, toXY, mainColor, strokeWidth, projectionColor);
      }
      
      // ═══════════════════════════════════════════════════════════════
      // WEDGE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('wedge')) {
        return buildWedgeSVG(renderContract, projection, toX, toY, toXY, mainColor, strokeWidth, projectionColor);
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE / CHANNEL
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('range') || patternType.includes('channel')) {
        return buildRangeSVG(renderContract, projection, toX, toY, toXY, mainColor, strokeWidth, projectionColor);
      }
      
      return null;
      
    } catch (err) {
      console.error('[PatternSVGOverlay] Error:', err);
      return null;
    }
  }, [chart, priceSeries, renderContract]);
  
  // ═══════════════════════════════════════════════════════════════
  // DOUBLE TOP / DOUBLE BOTTOM SVG BUILDER
  // ═══════════════════════════════════════════════════════════════
  
  const buildDoubleTopSVG = (contract, projection, toX, toY, toXY, mainColor, strokeWidth, projColor, invalidColor) => {
    const isDoubleTop = contract.type === 'double_top';
    const patternColor = isDoubleTop ? '#ef4444' : '#22c55e';
    
    // Get structure from projection_contract or fallback
    const structure = projection?.structure || {};
    const bounds = projection?.bounds || {};
    const completion = projection?.completion || {};
    const proj = projection?.projection || {};
    
    // Get points
    let points = structure.points || [];
    if (points.length < 3) {
      // Fallback to anchors
      const anchors = contract.anchors || {};
      const p1 = anchors.p1;
      const valley = anchors.valley;
      const p2 = anchors.p2;
      
      if (p1 && valley && p2) {
        points = [p1, valley, p2];
      } else if (Array.isArray(contract.anchors) && contract.anchors.length >= 2) {
        const sorted = [...contract.anchors].sort((a, b) => 
          isDoubleTop ? b.price - a.price : a.price - b.price
        );
        const peaks = sorted.slice(0, 2).sort((a, b) => a.time - b.time);
        const neckline = contract.meta?.neckline || bounds.neckline;
        points = [
          peaks[0],
          { time: (peaks[0].time + peaks[1].time) / 2, price: neckline },
          peaks[1]
        ];
      }
    }
    
    if (points.length < 3) return null;
    
    // Convert to screen coords
    const coords = points.map(toXY).filter(Boolean);
    if (coords.length < 3) return null;
    
    const [c1, cV, c2] = coords;
    const p1 = points[0];
    const valley = points[1];
    const p2 = points[2];
    
    // Neckline
    const neckline = bounds.neckline || bounds.support || valley.price;
    const yNeck = toY(neckline);
    if (yNeck === null) return null;
    
    // Resistance line (top)
    const resistance = bounds.resistance || (p1.price + p2.price) / 2;
    const yRes = toY(resistance);
    
    // Generate unique IDs for gradients
    const gradientId = `grad-dt-${Date.now()}`;
    const arrowId = `arrow-${Date.now()}`;
    
    const elements = [];
    
    // DEFS (gradients, markers)
    elements.push({
      tag: 'defs',
      props: { key: 'defs' },
      children: [
        // Gradient for fill
        {
          tag: 'linearGradient',
          props: { id: gradientId, x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
          children: [
            { tag: 'stop', props: { offset: '0%', stopColor: patternColor, stopOpacity: '0.25' } },
            { tag: 'stop', props: { offset: '100%', stopColor: patternColor, stopOpacity: '0.05' } },
          ]
        },
        // Arrow marker
        {
          tag: 'marker',
          props: {
            id: arrowId,
            markerWidth: '10',
            markerHeight: '10',
            refX: '6',
            refY: '3',
            orient: 'auto'
          },
          children: [
            { tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: projColor } }
          ]
        }
      ]
    });
    
    // LAYER 1: STRUCTURE — M-shape with fill
    // Fill polygon between M-line and neckline
    elements.push({
      tag: 'polygon',
      props: {
        key: 'fill',
        points: `${c1.x},${yNeck} ${c1.x},${c1.y} ${cV.x},${cV.y} ${c2.x},${c2.y} ${c2.x},${yNeck}`,
        fill: `url(#${gradientId})`,
        stroke: 'none',
      }
    });
    
    // M-shape polyline
    elements.push({
      tag: 'polyline',
      props: {
        key: 'mshape',
        points: `${c1.x},${c1.y} ${cV.x},${cV.y} ${c2.x},${c2.y}`,
        fill: 'none',
        stroke: patternColor,
        strokeWidth: strokeWidth + 1,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }
    });
    
    // LAYER 2: BOUNDS — Neckline and resistance
    // Neckline (dashed)
    elements.push({
      tag: 'line',
      props: {
        key: 'neckline',
        x1: Math.min(c1.x, c2.x) - 30,
        y1: yNeck,
        x2: Math.max(c1.x, c2.x) + 60,
        y2: yNeck,
        stroke: projColor,
        strokeWidth: 2,
        strokeDasharray: '8 4',
      }
    });
    
    // Resistance line (if double top)
    if (yRes && isDoubleTop) {
      elements.push({
        tag: 'line',
        props: {
          key: 'resistance',
          x1: Math.min(c1.x, c2.x) - 10,
          y1: yRes,
          x2: Math.max(c1.x, c2.x) + 10,
          y2: yRes,
          stroke: patternColor,
          strokeWidth: 1,
          strokeDasharray: '4 2',
          opacity: 0.5,
        }
      });
    }
    
    // LAYER 3: COMPLETION — Path from P2 to neckline
    elements.push({
      tag: 'line',
      props: {
        key: 'completion',
        x1: c2.x,
        y1: c2.y,
        x2: c2.x,
        y2: yNeck,
        stroke: '#888',
        strokeWidth: 1.5,
        strokeDasharray: '4 4',
      }
    });
    
    // LAYER 4: PROJECTION
    // Primary projection (down for double top, up for double bottom)
    const primary = proj.primary;
    if (primary && primary.target) {
      const yTarget = toY(primary.target);
      if (yTarget !== null) {
        // Arrow line
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-primary',
            x1: c2.x + 10,
            y1: yNeck,
            x2: c2.x + 40,
            y2: yTarget,
            stroke: projColor,
            strokeWidth: 2.5,
            markerEnd: `url(#${arrowId})`,
          }
        });
        
        // Target zone (rectangle)
        const zoneHeight = Math.abs(yTarget - yNeck) * 0.15;
        elements.push({
          tag: 'rect',
          props: {
            key: 'target-zone',
            x: c2.x + 5,
            y: isDoubleTop ? yTarget - zoneHeight/2 : yTarget - zoneHeight/2,
            width: 50,
            height: zoneHeight,
            fill: projColor,
            fillOpacity: 0.15,
            stroke: projColor,
            strokeWidth: 1,
            strokeDasharray: '3 2',
          }
        });
        
        // Target label
        elements.push({
          tag: 'text',
          props: {
            key: 'target-label',
            x: c2.x + 60,
            y: yTarget + 4,
            fill: projColor,
            fontSize: '11px',
            fontWeight: 'bold',
          },
          content: `T: ${primary.target.toFixed(0)}`
        });
      }
    }
    
    // Secondary projection (invalidation)
    const secondary = proj.secondary;
    if (secondary && secondary.target) {
      const yInvalid = toY(secondary.target);
      if (yInvalid !== null) {
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-secondary',
            x1: c2.x + 15,
            y1: c2.y,
            x2: c2.x + 35,
            y2: yInvalid,
            stroke: invalidColor,
            strokeWidth: 1.5,
            strokeDasharray: '4 3',
          }
        });
        
        elements.push({
          tag: 'text',
          props: {
            key: 'invalid-label',
            x: c2.x + 40,
            y: yInvalid + 4,
            fill: invalidColor,
            fontSize: '10px',
          },
          content: 'INV'
        });
      }
    }
    
    // Peak markers
    elements.push({
      tag: 'circle',
      props: { key: 'p1-marker', cx: c1.x, cy: c1.y, r: 5, fill: patternColor, stroke: '#fff', strokeWidth: 2 }
    });
    elements.push({
      tag: 'circle',
      props: { key: 'p2-marker', cx: c2.x, cy: c2.y, r: 5, fill: patternColor, stroke: '#fff', strokeWidth: 2 }
    });
    elements.push({
      tag: 'circle',
      props: { key: 'v-marker', cx: cV.x, cy: cV.y, r: 4, fill: projColor, stroke: '#fff', strokeWidth: 1.5 }
    });
    
    // Labels
    elements.push({
      tag: 'text',
      props: { key: 'p1-label', x: c1.x, y: c1.y - 14, fill: patternColor, fontSize: '11px', fontWeight: 'bold', textAnchor: 'middle' },
      content: 'P1'
    });
    elements.push({
      tag: 'text',
      props: { key: 'p2-label', x: c2.x, y: c2.y - 14, fill: patternColor, fontSize: '11px', fontWeight: 'bold', textAnchor: 'middle' },
      content: 'P2'
    });
    elements.push({
      tag: 'text',
      props: { key: 'v-label', x: cV.x, y: cV.y + 18, fill: projColor, fontSize: '10px', fontWeight: 'bold', textAnchor: 'middle' },
      content: 'V'
    });
    
    // Stage indicator
    const stage = projection?.stage || 'forming';
    const stageColors = {
      forming: '#fbbf24',
      maturing: '#f97316',
      confirmed: '#22c55e',
      invalidated: '#ef4444'
    };
    elements.push({
      tag: 'text',
      props: {
        key: 'stage',
        x: Math.min(c1.x, c2.x) - 30,
        y: yNeck - 8,
        fill: stageColors[stage] || '#888',
        fontSize: '10px',
        fontWeight: 'bold',
      },
      content: stage.toUpperCase()
    });
    
    return { type: 'double_top', elements };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // TRIANGLE SVG BUILDER
  // ═══════════════════════════════════════════════════════════════
  
  const buildTriangleSVG = (contract, projection, toX, toY, toXY, mainColor, strokeWidth, projColor) => {
    const structure = projection?.structure || {};
    const bounds = projection?.bounds || {};
    const completion = projection?.completion || {};
    const proj = projection?.projection || {};
    
    // Get boundaries
    const boundaries = contract.meta?.boundaries || {};
    const upper = bounds.upper_line || boundaries.upper;
    const lower = bounds.lower_line || boundaries.lower;
    
    if (!upper || !lower) return null;
    
    // Convert to screen coords
    const x1u = toX(upper.x1);
    const y1u = toY(upper.y1);
    const x2u = toX(upper.x2);
    const y2u = toY(upper.y2);
    const x1l = toX(lower.x1);
    const y1l = toY(lower.y1);
    const x2l = toX(lower.x2);
    const y2l = toY(lower.y2);
    
    if ([x1u, y1u, x2u, y2u, x1l, y1l, x2l, y2l].some(v => v === null)) return null;
    
    const gradientId = `grad-tri-${Date.now()}`;
    const arrowId = `arrow-tri-${Date.now()}`;
    
    const elements = [];
    
    // Defs
    elements.push({
      tag: 'defs',
      props: { key: 'defs' },
      children: [
        {
          tag: 'linearGradient',
          props: { id: gradientId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          children: [
            { tag: 'stop', props: { offset: '0%', stopColor: '#00bfff', stopOpacity: '0.15' } },
            { tag: 'stop', props: { offset: '100%', stopColor: '#00bfff', stopOpacity: '0.05' } },
          ]
        },
        {
          tag: 'marker',
          props: { id: arrowId, markerWidth: '10', markerHeight: '10', refX: '6', refY: '3', orient: 'auto' },
          children: [{ tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: projColor } }]
        }
      ]
    });
    
    // LAYER 1: STRUCTURE — Triangle fill
    elements.push({
      tag: 'polygon',
      props: {
        key: 'fill',
        points: `${x1u},${y1u} ${x2u},${y2u} ${x2l},${y2l} ${x1l},${y1l}`,
        fill: `url(#${gradientId})`,
        stroke: 'none',
      }
    });
    
    // Upper line
    elements.push({
      tag: 'line',
      props: {
        key: 'upper',
        x1: x1u, y1: y1u, x2: x2u, y2: y2u,
        stroke: '#ef4444',
        strokeWidth: strokeWidth,
      }
    });
    
    // Lower line
    elements.push({
      tag: 'line',
      props: {
        key: 'lower',
        x1: x1l, y1: y1l, x2: x2l, y2: y2l,
        stroke: '#22c55e',
        strokeWidth: strokeWidth,
      }
    });
    
    // LAYER 3: COMPLETION — Apex
    const apex = completion.apex;
    if (apex) {
      const apexXY = toXY(apex);
      if (apexXY) {
        elements.push({
          tag: 'circle',
          props: {
            key: 'apex',
            cx: apexXY.x, cy: apexXY.y, r: 6,
            fill: 'none',
            stroke: projColor,
            strokeWidth: 2,
            strokeDasharray: '3 2',
          }
        });
        elements.push({
          tag: 'text',
          props: { key: 'apex-label', x: apexXY.x + 10, y: apexXY.y + 4, fill: projColor, fontSize: '10px' },
          content: 'APEX'
        });
      }
    }
    
    // LAYER 4: PROJECTION
    const primary = proj.primary;
    if (primary && primary.target) {
      const startX = x2u;
      const startY = (y2u + y2l) / 2;
      const yTarget = toY(primary.target);
      
      if (yTarget !== null) {
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-primary',
            x1: startX, y1: startY,
            x2: startX + 50, y2: yTarget,
            stroke: projColor,
            strokeWidth: 2.5,
            markerEnd: `url(#${arrowId})`,
          }
        });
        
        elements.push({
          tag: 'text',
          props: { key: 'target-label', x: startX + 55, y: yTarget + 4, fill: projColor, fontSize: '11px', fontWeight: 'bold' },
          content: `T: ${primary.target.toFixed(0)}`
        });
      }
    }
    
    return { type: 'triangle', elements };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // WEDGE SVG BUILDER
  // ═══════════════════════════════════════════════════════════════
  
  const buildWedgeSVG = (contract, projection, toX, toY, toXY, mainColor, strokeWidth, projColor) => {
    // Similar to triangle but with different colors
    const isFalling = contract.type.includes('falling');
    const wedgeColor = isFalling ? '#22c55e' : '#ef4444';
    
    const boundaries = contract.meta?.boundaries || {};
    const upper = boundaries.upper;
    const lower = boundaries.lower;
    
    if (!upper || !lower) return null;
    
    const x1u = toX(upper.x1);
    const y1u = toY(upper.y1);
    const x2u = toX(upper.x2);
    const y2u = toY(upper.y2);
    const x1l = toX(lower.x1);
    const y1l = toY(lower.y1);
    const x2l = toX(lower.x2);
    const y2l = toY(lower.y2);
    
    if ([x1u, y1u, x2u, y2u, x1l, y1l, x2l, y2l].some(v => v === null)) return null;
    
    const gradientId = `grad-wedge-${Date.now()}`;
    const arrowId = `arrow-wedge-${Date.now()}`;
    
    const proj = projection?.projection || {};
    
    const elements = [];
    
    // Defs
    elements.push({
      tag: 'defs',
      props: { key: 'defs' },
      children: [
        {
          tag: 'linearGradient',
          props: { id: gradientId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' },
          children: [
            { tag: 'stop', props: { offset: '0%', stopColor: wedgeColor, stopOpacity: '0.12' } },
            { tag: 'stop', props: { offset: '100%', stopColor: wedgeColor, stopOpacity: '0.03' } },
          ]
        },
        {
          tag: 'marker',
          props: { id: arrowId, markerWidth: '10', markerHeight: '10', refX: '6', refY: '3', orient: 'auto' },
          children: [{ tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: projColor } }]
        }
      ]
    });
    
    // Fill
    elements.push({
      tag: 'polygon',
      props: {
        key: 'fill',
        points: `${x1u},${y1u} ${x2u},${y2u} ${x2l},${y2l} ${x1l},${y1l}`,
        fill: `url(#${gradientId})`,
      }
    });
    
    // Lines
    elements.push({
      tag: 'line',
      props: { key: 'upper', x1: x1u, y1: y1u, x2: x2u, y2: y2u, stroke: wedgeColor, strokeWidth: strokeWidth }
    });
    elements.push({
      tag: 'line',
      props: { key: 'lower', x1: x1l, y1: y1l, x2: x2l, y2: y2l, stroke: wedgeColor, strokeWidth: strokeWidth }
    });
    
    // Projection
    const primary = proj.primary;
    if (primary && primary.target) {
      const startX = Math.max(x2u, x2l);
      const startY = (y2u + y2l) / 2;
      const yTarget = toY(primary.target);
      
      if (yTarget !== null) {
        elements.push({
          tag: 'line',
          props: {
            key: 'proj',
            x1: startX, y1: startY,
            x2: startX + 50, y2: yTarget,
            stroke: projColor,
            strokeWidth: 2.5,
            markerEnd: `url(#${arrowId})`,
          }
        });
      }
    }
    
    // Type label
    elements.push({
      tag: 'text',
      props: { key: 'type-label', x: x1u, y: y1u - 10, fill: wedgeColor, fontSize: '11px', fontWeight: 'bold' },
      content: isFalling ? 'FALLING WEDGE' : 'RISING WEDGE'
    });
    
    return { type: 'wedge', elements };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // RANGE SVG BUILDER
  // ═══════════════════════════════════════════════════════════════
  
  const buildRangeSVG = (contract, projection, toX, toY, toXY, mainColor, strokeWidth, projColor) => {
    const bounds = projection?.bounds || contract.bounds || {};
    const boundaries = contract.meta?.boundaries || {};
    const upper = boundaries.upper || {};
    const lower = boundaries.lower || {};
    
    const resistance = bounds.resistance || bounds.top || Math.max(upper.y1 || 0, upper.y2 || 0);
    const support = bounds.support || bounds.bottom || Math.min(lower.y1 || 0, lower.y2 || 0);
    
    if (!resistance || !support) return null;
    
    const xStart = toX(upper.x1 || lower.x1);
    const xEnd = toX(upper.x2 || lower.x2);
    const yRes = toY(resistance);
    const ySup = toY(support);
    
    if ([xStart, xEnd, yRes, ySup].some(v => v === null)) return null;
    
    const proj = projection?.projection || {};
    const confidence = contract.confidence || 0.5;
    const touches = contract.touches || 0;
    
    const gradientId = `grad-range-${Date.now()}`;
    const arrowId = `arrow-range-${Date.now()}`;
    
    const elements = [];
    
    // Defs
    elements.push({
      tag: 'defs',
      props: { key: 'defs' },
      children: [
        {
          tag: 'linearGradient',
          props: { id: gradientId, x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
          children: [
            { tag: 'stop', props: { offset: '0%', stopColor: '#3b82f6', stopOpacity: String(confidence * 0.25) } },
            { tag: 'stop', props: { offset: '100%', stopColor: '#3b82f6', stopOpacity: '0.05' } },
          ]
        },
        {
          tag: 'marker',
          props: { id: arrowId, markerWidth: '10', markerHeight: '10', refX: '6', refY: '3', orient: 'auto' },
          children: [{ tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: projColor } }]
        }
      ]
    });
    
    // Fill rect
    elements.push({
      tag: 'rect',
      props: {
        key: 'fill',
        x: xStart - 5,
        y: yRes,
        width: (xEnd - xStart) + 10,
        height: ySup - yRes,
        fill: `url(#${gradientId})`,
        stroke: '#3b82f6',
        strokeWidth: 1,
        rx: 4,
        ry: 4,
      }
    });
    
    // Resistance line
    elements.push({
      tag: 'line',
      props: {
        key: 'resistance',
        x1: xStart - 20, y1: yRes,
        x2: xEnd + 40, y2: yRes,
        stroke: '#ef4444',
        strokeWidth: 2,
        strokeDasharray: '6 3',
      }
    });
    
    // Support line
    elements.push({
      tag: 'line',
      props: {
        key: 'support',
        x1: xStart - 20, y1: ySup,
        x2: xEnd + 40, y2: ySup,
        stroke: '#22c55e',
        strokeWidth: 2,
        strokeDasharray: '6 3',
      }
    });
    
    // Labels
    elements.push({
      tag: 'text',
      props: { key: 'r-label', x: xEnd + 45, y: yRes + 4, fill: '#ef4444', fontSize: '12px', fontWeight: 'bold' },
      content: 'R'
    });
    elements.push({
      tag: 'text',
      props: { key: 's-label', x: xEnd + 45, y: ySup + 4, fill: '#22c55e', fontSize: '12px', fontWeight: 'bold' },
      content: 'S'
    });
    
    // Touch count
    if (touches > 0) {
      elements.push({
        tag: 'text',
        props: {
          key: 'touches',
          x: (xStart + xEnd) / 2,
          y: (yRes + ySup) / 2 + 4,
          fill: '#64748b',
          fontSize: '10px',
          textAnchor: 'middle',
          opacity: 0.8,
        },
        content: `${touches} touches`
      });
    }
    
    // Projections
    const primary = proj.primary;
    const secondary = proj.secondary;
    
    if (primary && primary.target) {
      const yTarget = toY(primary.target);
      if (yTarget !== null) {
        const isPrimaryUp = primary.direction === 'up';
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-up',
            x1: xEnd + 10,
            y1: isPrimaryUp ? yRes : ySup,
            x2: xEnd + 40,
            y2: yTarget,
            stroke: projColor,
            strokeWidth: 2,
            markerEnd: `url(#${arrowId})`,
          }
        });
      }
    }
    
    if (secondary && secondary.target) {
      const yTarget = toY(secondary.target);
      if (yTarget !== null) {
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-down',
            x1: xEnd + 10,
            y1: secondary.direction === 'up' ? yRes : ySup,
            x2: xEnd + 40,
            y2: yTarget,
            stroke: '#fbbf24',
            strokeWidth: 1.5,
            strokeDasharray: '4 3',
          }
        });
      }
    }
    
    return { type: 'range', elements };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // UPDATE EFFECT
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!chart || !priceSeries || !renderContract) {
      setSvgData(null);
      return;
    }
    
    const update = () => {
      const data = calculateCoordinates();
      setSvgData(data);
    };
    
    update();
    
    // Subscribe to chart changes
    const timeScale = chart.timeScale();
    
    if (timeScale) {
      timeScale.subscribeVisibleTimeRangeChange(update);
    }
    
    chart.subscribeCrosshairMove(update);
    
    return () => {
      if (timeScale) {
        timeScale.unsubscribeVisibleTimeRangeChange(update);
      }
      chart.unsubscribeCrosshairMove(update);
    };
  }, [chart, priceSeries, renderContract, calculateCoordinates]);
  
  // ═══════════════════════════════════════════════════════════════
  // RENDER SVG
  // ═══════════════════════════════════════════════════════════════
  
  if (!svgData || !svgData.elements) return null;
  
  // Recursive element renderer
  const renderElement = (el, idx) => {
    if (!el || !el.tag) return null;
    
    const Tag = el.tag;
    const key = el.props?.key || `el-${idx}`;
    const props = { ...el.props, key };
    
    if (el.children && Array.isArray(el.children)) {
      return (
        <Tag {...props}>
          {el.children.map((child, i) => renderElement(child, `${key}-${i}`))}
        </Tag>
      );
    }
    
    if (el.content) {
      return <Tag {...props}>{el.content}</Tag>;
    }
    
    return <Tag {...props} />;
  };
  
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {svgData.elements.map((el, idx) => renderElement(el, idx))}
    </svg>
  );
};

export default PatternSVGOverlay;
