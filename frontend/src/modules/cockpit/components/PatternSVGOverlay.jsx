/**
 * PatternSVGOverlay.jsx (V4 — Render Profile Support)
 * 
 * Упрощённый рендер с поддержкой render_profile от backend.
 * 
 * ГЛАВНЫЕ ПРАВИЛА:
 * - loose patterns → minimal (только body, без projection)
 * - strict forming → compact (body + bounds, без projection)
 * - strict confirmed → full (всё включено)
 * 
 * Render Modes:
 * - Double Top/Bottom: M-shape + neckline (compact)
 * - Range: Rectangle only (box)
 * - Triangle/Wedge: Lines only (clean)
 */

import React, { useEffect, useState, useCallback } from 'react';

const PatternSVGOverlay = ({ chart, priceSeries, pattern, renderContract }) => {
  const [svgData, setSvgData] = useState(null);
  
  const calculateCoordinates = useCallback(() => {
    if (!chart || !renderContract || !priceSeries) return null;
    
    try {
      const timeScale = chart.timeScale();
      if (!timeScale) return null;
      
      // Coordinate converters
      const toX = (time) => {
        const t = time > 1e12 ? Math.floor(time / 1000) : time;
        return timeScale.timeToCoordinate(t);
      };
      
      const toY = (price) => {
        try {
          return priceSeries.priceToCoordinate(price);
        } catch (e) {
          return null;
        }
      };
      
      const toXY = (p) => {
        if (!p) return null;
        const x = toX(p.time);
        const y = toY(p.price);
        if (x === null || y === null) return null;
        return { x, y };
      };
      
      const patternType = renderContract.type || '';
      const mode = renderContract.mode || 'strict';
      
      // Get render profile from backend (or use defaults)
      const profile = renderContract.render_profile || {
        draw_structure: true,
        draw_fill: mode !== 'loose',
        draw_bounds: true,
        draw_completion: false,
        draw_projection: false,
        draw_labels: false,
        draw_stage: false,
        stroke_width: mode === 'loose' ? 1.5 : 2.0,
        fill_opacity: mode === 'loose' ? 0.05 : 0.1,
        use_dashed: mode === 'loose',
      };
      
      // Get projection data (may be null if profile disables it)
      const projection = profile.draw_projection ? 
        (renderContract.projection_contract || renderContract.projection) : null;
      
      // ═══════════════════════════════════════════════════════════════
      // DOUBLE TOP / DOUBLE BOTTOM — COMPACT MODE
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        return buildDoubleTopCompact(renderContract, profile, projection, toX, toY, toXY);
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE — BOX MODE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('range') || patternType.includes('channel')) {
        return buildRangeBox(renderContract, profile, projection, toX, toY);
      }
      
      // ═══════════════════════════════════════════════════════════════
      // TRIANGLE / WEDGE — CLEAN MODE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('triangle') || patternType.includes('wedge')) {
        return buildTriangleClean(renderContract, profile, projection, toX, toY);
      }
      
      return null;
      
    } catch (err) {
      console.error('[PatternSVGOverlay] Error:', err);
      return null;
    }
  }, [chart, priceSeries, renderContract]);
  
  // ═══════════════════════════════════════════════════════════════
  // DOUBLE TOP/BOTTOM — COMPACT (M + neckline only)
  // ═══════════════════════════════════════════════════════════════
  
  const buildDoubleTopCompact = (contract, profile, projection, toX, toY, toXY) => {
    const isDoubleTop = contract.type === 'double_top';
    const patternColor = isDoubleTop ? '#ef4444' : '#22c55e';
    const necklineColor = '#00bfff';
    
    // Get points
    const anchors = contract.anchors || {};
    let p1 = anchors.p1;
    let valley = anchors.valley;
    let p2 = anchors.p2;
    
    // Fallback to projection structure
    if ((!p1 || !p2) && projection?.structure?.points) {
      const pts = projection.structure.points;
      if (pts.length >= 3) {
        p1 = pts[0];
        valley = pts[1];
        p2 = pts[2];
      }
    }
    
    // Fallback to array anchors
    if ((!p1 || !p2) && Array.isArray(contract.anchors)) {
      const sorted = [...contract.anchors].sort((a, b) => 
        isDoubleTop ? b.price - a.price : a.price - b.price
      );
      if (sorted.length >= 2) {
        const peaks = sorted.slice(0, 2).sort((a, b) => a.time - b.time);
        p1 = peaks[0];
        p2 = peaks[1];
        const necklinePrice = contract.meta?.neckline || contract.meta?.boundaries?.neckline;
        valley = { time: (p1.time + p2.time) / 2, price: necklinePrice || p1.price * 0.97 };
      }
    }
    
    if (!p1 || !p2 || !valley) return null;
    
    // Convert to screen
    const c1 = toXY(p1);
    const cV = toXY(valley);
    const c2 = toXY(p2);
    
    if (!c1 || !cV || !c2) return null;
    
    // Neckline
    const neckline = projection?.bounds?.neckline || contract.meta?.neckline || valley.price;
    const yNeck = toY(neckline);
    if (yNeck === null) return null;
    
    const strokeWidth = profile.stroke_width || 2;
    const fillOpacity = profile.fill_opacity || 0.1;
    const useDashed = profile.use_dashed;
    
    const elements = [];
    const gradientId = `grad-dt-${Date.now()}`;
    
    // Defs
    if (profile.draw_fill) {
      elements.push({
        tag: 'defs',
        props: { key: 'defs' },
        children: [{
          tag: 'linearGradient',
          props: { id: gradientId, x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
          children: [
            { tag: 'stop', props: { offset: '0%', stopColor: patternColor, stopOpacity: String(fillOpacity * 2) } },
            { tag: 'stop', props: { offset: '100%', stopColor: patternColor, stopOpacity: String(fillOpacity * 0.3) } },
          ]
        }]
      });
    }
    
    // LAYER 1: STRUCTURE — M-shape
    if (profile.draw_structure) {
      // Fill (optional)
      if (profile.draw_fill) {
        elements.push({
          tag: 'polygon',
          props: {
            key: 'fill',
            points: `${c1.x},${yNeck} ${c1.x},${c1.y} ${cV.x},${cV.y} ${c2.x},${c2.y} ${c2.x},${yNeck}`,
            fill: `url(#${gradientId})`,
            stroke: 'none',
          }
        });
      }
      
      // M-shape polyline
      elements.push({
        tag: 'polyline',
        props: {
          key: 'mshape',
          points: `${c1.x},${c1.y} ${cV.x},${cV.y} ${c2.x},${c2.y}`,
          fill: 'none',
          stroke: patternColor,
          strokeWidth: strokeWidth + 0.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeDasharray: useDashed ? '6 4' : 'none',
        }
      });
    }
    
    // LAYER 2: BOUNDS — Neckline only
    if (profile.draw_bounds) {
      elements.push({
        tag: 'line',
        props: {
          key: 'neckline',
          x1: Math.min(c1.x, c2.x) - 20,
          y1: yNeck,
          x2: Math.max(c1.x, c2.x) + 40,
          y2: yNeck,
          stroke: necklineColor,
          strokeWidth: 1.5,
          strokeDasharray: '6 3',
        }
      });
    }
    
    // LAYER 3: COMPLETION (only if profile allows)
    if (profile.draw_completion) {
      elements.push({
        tag: 'line',
        props: {
          key: 'completion',
          x1: c2.x,
          y1: c2.y,
          x2: c2.x,
          y2: yNeck,
          stroke: '#666',
          strokeWidth: 1,
          strokeDasharray: '3 3',
        }
      });
    }
    
    // LAYER 4: PROJECTION (only if profile allows AND we have data)
    if (profile.draw_projection && projection?.projection?.primary) {
      const primary = projection.projection.primary;
      const yTarget = toY(primary.target);
      
      if (yTarget !== null) {
        const arrowId = `arrow-${Date.now()}`;
        
        // Arrow marker
        elements.push({
          tag: 'defs',
          props: { key: 'arrow-defs' },
          children: [{
            tag: 'marker',
            props: {
              id: arrowId,
              markerWidth: '8',
              markerHeight: '8',
              refX: '5',
              refY: '3',
              orient: 'auto'
            },
            children: [{ tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: necklineColor } }]
          }]
        });
        
        // Arrow line
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-primary',
            x1: c2.x + 8,
            y1: yNeck,
            x2: c2.x + 30,
            y2: yTarget,
            stroke: necklineColor,
            strokeWidth: 2,
            markerEnd: `url(#${arrowId})`,
          }
        });
        
        // Target label
        elements.push({
          tag: 'text',
          props: {
            key: 'target-label',
            x: c2.x + 35,
            y: yTarget + 4,
            fill: necklineColor,
            fontSize: '10px',
            fontWeight: 'bold',
          },
          content: `${primary.target.toFixed(0)}`
        });
      }
    }
    
    // Labels (only if profile allows)
    if (profile.draw_labels) {
      elements.push({
        tag: 'text',
        props: { key: 'p1-label', x: c1.x, y: c1.y - 10, fill: patternColor, fontSize: '10px', fontWeight: 'bold', textAnchor: 'middle' },
        content: 'P1'
      });
      elements.push({
        tag: 'text',
        props: { key: 'p2-label', x: c2.x, y: c2.y - 10, fill: patternColor, fontSize: '10px', fontWeight: 'bold', textAnchor: 'middle' },
        content: 'P2'
      });
    }
    
    return { type: 'double_top', elements };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // RANGE — BOX MODE (rectangle only)
  // ═══════════════════════════════════════════════════════════════
  
  const buildRangeBox = (contract, profile, projection, toX, toY) => {
    // Get bounds
    const bounds = projection?.bounds || contract.bounds || {};
    const boundaries = contract.meta?.boundaries || {};
    const upper = boundaries.upper || {};
    const lower = boundaries.lower || {};
    
    const resistance = bounds.resistance || bounds.top || Math.max(upper.y1 || 0, upper.y2 || 0);
    const support = bounds.support || bounds.bottom || Math.min(lower.y1 || 0, lower.y2 || 0);
    
    if (!resistance || !support || resistance <= support) return null;
    
    // Get window
    const xStart = toX(upper.x1 || lower.x1 || contract.meta?.start_time);
    const xEnd = toX(upper.x2 || lower.x2 || contract.meta?.end_time);
    const yRes = toY(resistance);
    const ySup = toY(support);
    
    if ([xStart, xEnd, yRes, ySup].some(v => v === null)) return null;
    
    const strokeWidth = profile.stroke_width || 1.5;
    const fillOpacity = profile.fill_opacity || 0.08;
    const useDashed = profile.use_dashed;
    
    const elements = [];
    
    // STRUCTURE — Rectangle
    if (profile.draw_structure) {
      elements.push({
        tag: 'rect',
        props: {
          key: 'box',
          x: xStart,
          y: yRes,
          width: Math.max(xEnd - xStart, 50),
          height: Math.max(ySup - yRes, 10),
          fill: profile.draw_fill ? `rgba(59, 130, 246, ${fillOpacity})` : 'none',
          stroke: '#3b82f6',
          strokeWidth: strokeWidth,
          strokeDasharray: useDashed ? '6 4' : 'none',
          rx: 3,
          ry: 3,
        }
      });
    }
    
    // BOUNDS — R/S lines
    if (profile.draw_bounds) {
      // Resistance
      elements.push({
        tag: 'line',
        props: {
          key: 'resistance',
          x1: xStart - 10,
          y1: yRes,
          x2: xEnd + 20,
          y2: yRes,
          stroke: '#ef4444',
          strokeWidth: 1.5,
          strokeDasharray: '4 2',
        }
      });
      
      // Support
      elements.push({
        tag: 'line',
        props: {
          key: 'support',
          x1: xStart - 10,
          y1: ySup,
          x2: xEnd + 20,
          y2: ySup,
          stroke: '#22c55e',
          strokeWidth: 1.5,
          strokeDasharray: '4 2',
        }
      });
      
      // R/S labels
      elements.push({
        tag: 'text',
        props: { key: 'r-label', x: xEnd + 25, y: yRes + 4, fill: '#ef4444', fontSize: '11px', fontWeight: 'bold' },
        content: 'R'
      });
      elements.push({
        tag: 'text',
        props: { key: 's-label', x: xEnd + 25, y: ySup + 4, fill: '#22c55e', fontSize: '11px', fontWeight: 'bold' },
        content: 'S'
      });
    }
    
    // PROJECTION (only if allowed)
    if (profile.draw_projection && projection?.projection?.primary) {
      const primary = projection.projection.primary;
      const yTarget = toY(primary.target);
      
      if (yTarget !== null) {
        const arrowId = `arrow-range-${Date.now()}`;
        
        elements.push({
          tag: 'defs',
          props: { key: 'arrow-defs' },
          children: [{
            tag: 'marker',
            props: { id: arrowId, markerWidth: '8', markerHeight: '8', refX: '5', refY: '3', orient: 'auto' },
            children: [{ tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: '#00bfff' } }]
          }]
        });
        
        elements.push({
          tag: 'line',
          props: {
            key: 'proj-line',
            x1: xEnd + 5,
            y1: primary.direction === 'up' ? yRes : ySup,
            x2: xEnd + 30,
            y2: yTarget,
            stroke: '#00bfff',
            strokeWidth: 2,
            markerEnd: `url(#${arrowId})`,
          }
        });
      }
    }
    
    return { type: 'range', elements };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // TRIANGLE / WEDGE — CLEAN MODE (lines only)
  // ═══════════════════════════════════════════════════════════════
  
  const buildTriangleClean = (contract, profile, projection, toX, toY) => {
    const isWedge = contract.type.includes('wedge');
    const isFalling = contract.type.includes('falling');
    const lineColor = isWedge ? (isFalling ? '#22c55e' : '#ef4444') : '#00bfff';
    
    // Get boundaries
    const boundaries = contract.meta?.boundaries || {};
    const projBounds = projection?.bounds || {};
    
    const upper = projBounds.upper_line || boundaries.upper;
    const lower = projBounds.lower_line || boundaries.lower;
    
    if (!upper || !lower) return null;
    
    // Convert to screen
    const x1u = toX(upper.x1);
    const y1u = toY(upper.y1);
    const x2u = toX(upper.x2);
    const y2u = toY(upper.y2);
    const x1l = toX(lower.x1);
    const y1l = toY(lower.y1);
    const x2l = toX(lower.x2);
    const y2l = toY(lower.y2);
    
    if ([x1u, y1u, x2u, y2u, x1l, y1l, x2l, y2l].some(v => v === null)) return null;
    
    const strokeWidth = profile.stroke_width || 2;
    const fillOpacity = profile.fill_opacity || 0.08;
    const useDashed = profile.use_dashed;
    
    const elements = [];
    
    // STRUCTURE
    if (profile.draw_structure) {
      // Fill (optional)
      if (profile.draw_fill) {
        elements.push({
          tag: 'polygon',
          props: {
            key: 'fill',
            points: `${x1u},${y1u} ${x2u},${y2u} ${x2l},${y2l} ${x1l},${y1l}`,
            fill: `rgba(0, 191, 255, ${fillOpacity})`,
            stroke: 'none',
          }
        });
      }
      
      // Upper line
      elements.push({
        tag: 'line',
        props: {
          key: 'upper',
          x1: x1u, y1: y1u, x2: x2u, y2: y2u,
          stroke: lineColor,
          strokeWidth: strokeWidth,
          strokeDasharray: useDashed ? '6 4' : 'none',
        }
      });
      
      // Lower line
      elements.push({
        tag: 'line',
        props: {
          key: 'lower',
          x1: x1l, y1: y1l, x2: x2l, y2: y2l,
          stroke: lineColor,
          strokeWidth: strokeWidth,
          strokeDasharray: useDashed ? '6 4' : 'none',
        }
      });
    }
    
    // Type label (only if allowed)
    if (profile.draw_labels) {
      const label = isWedge ? (isFalling ? 'FALLING' : 'RISING') : 'TRIANGLE';
      elements.push({
        tag: 'text',
        props: { key: 'type-label', x: x1u, y: y1u - 8, fill: lineColor, fontSize: '10px', fontWeight: 'bold' },
        content: label
      });
    }
    
    // PROJECTION (only if allowed)
    if (profile.draw_projection && projection?.projection?.primary) {
      const primary = projection.projection.primary;
      const yTarget = toY(primary.target);
      const startX = Math.max(x2u, x2l);
      const startY = (y2u + y2l) / 2;
      
      if (yTarget !== null) {
        const arrowId = `arrow-tri-${Date.now()}`;
        
        elements.push({
          tag: 'defs',
          props: { key: 'arrow-defs' },
          children: [{
            tag: 'marker',
            props: { id: arrowId, markerWidth: '8', markerHeight: '8', refX: '5', refY: '3', orient: 'auto' },
            children: [{ tag: 'path', props: { d: 'M0,0 L0,6 L6,3 z', fill: '#00bfff' } }]
          }]
        });
        
        elements.push({
          tag: 'line',
          props: {
            key: 'proj',
            x1: startX, y1: startY,
            x2: startX + 40, y2: yTarget,
            stroke: '#00bfff',
            strokeWidth: 2,
            markerEnd: `url(#${arrowId})`,
          }
        });
      }
    }
    
    return { type: 'triangle', elements };
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
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  
  if (!svgData || !svgData.elements) return null;
  
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
