/**
 * PatternSVGOverlay.jsx — CLEAN VERSION
 * 
 * Простой SVG overlay для паттернов:
 * - Double Top/Bottom: M-shape + neckline
 * - Range: Rectangle box
 * - Triangle/Wedge: Two lines
 */

import React, { useEffect, useState, useCallback } from 'react';

const PatternSVGOverlay = ({ chart, priceSeries, pattern, renderContract }) => {
  const [svgElements, setSvgElements] = useState([]);
  
  // Build SVG elements from pattern data
  const buildElements = useCallback(() => {
    if (!chart || !priceSeries || !renderContract) {
      return [];
    }
    
    try {
      const timeScale = chart.timeScale();
      if (!timeScale) return [];
      
      // Time normalization (ms → s)
      const normalizeTime = (t) => {
        if (!t) return t;
        return t > 9999999999 ? Math.floor(t / 1000) : t;
      };
      
      // Coordinate converters
      const toX = (time) => timeScale.timeToCoordinate(normalizeTime(time));
      const toY = (price) => {
        try {
          return priceSeries.priceToCoordinate(price);
        } catch {
          return null;
        }
      };
      
      const patternType = renderContract.type || '';
      const anchors = renderContract.anchors || {};
      const meta = renderContract.meta || {};
      
      // ═══════════════════════════════════════════════════════════════
      // DOUBLE TOP / DOUBLE BOTTOM
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        const isTop = patternType === 'double_top';
        const color = isTop ? '#ef4444' : '#22c55e';
        
        // Get points
        let p1, valley, p2;
        
        if (anchors.p1 && anchors.p2) {
          p1 = anchors.p1;
          p2 = anchors.p2;
          valley = anchors.valley;
        } else if (Array.isArray(renderContract.anchors)) {
          const arr = renderContract.anchors;
          if (arr.length >= 2) {
            const sorted = [...arr].sort((a, b) => isTop ? b.price - a.price : a.price - b.price);
            const peaks = sorted.slice(0, 2).sort((a, b) => a.time - b.time);
            p1 = peaks[0];
            p2 = peaks[1];
          }
        }
        
        if (!p1 || !p2) return [];
        
        // Get neckline
        const neckline = meta.neckline || 
                        (valley ? valley.price : null) ||
                        (isTop ? Math.min(p1.price, p2.price) * 0.98 : Math.max(p1.price, p2.price) * 1.02);
        
        // Create valley if not provided
        if (!valley) {
          valley = {
            time: (p1.time + p2.time) / 2,
            price: neckline
          };
        }
        
        // Convert to screen coords
        const x1 = toX(p1.time);
        const y1 = toY(p1.price);
        const xV = toX(valley.time);
        const yV = toY(valley.price);
        const x2 = toX(p2.time);
        const y2 = toY(p2.price);
        const yNeck = toY(neckline);
        
        // Check validity
        if ([x1, y1, xV, yV, x2, y2, yNeck].some(v => v === null || v === undefined)) {
          console.log('[PatternSVGOverlay] Double top coords invalid:', { x1, y1, xV, yV, x2, y2, yNeck });
          return [];
        }
        
        const elements = [];
        
        // 1. M-shape polyline (P1 → Valley → P2)
        elements.push(
          <polyline
            key="mshape"
            points={`${x1},${y1} ${xV},${yV} ${x2},${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
        
        // 2. Neckline (dashed horizontal)
        elements.push(
          <line
            key="neckline"
            x1={Math.min(x1, x2) - 30}
            y1={yNeck}
            x2={Math.max(x1, x2) + 50}
            y2={yNeck}
            stroke="#00bfff"
            strokeWidth={2}
            strokeDasharray="8 4"
          />
        );
        
        // 3. Peak markers
        elements.push(
          <circle key="p1" cx={x1} cy={y1} r={5} fill={color} stroke="#fff" strokeWidth={2} />
        );
        elements.push(
          <circle key="p2" cx={x2} cy={y2} r={5} fill={color} stroke="#fff" strokeWidth={2} />
        );
        elements.push(
          <circle key="valley" cx={xV} cy={yV} r={4} fill="#00bfff" stroke="#fff" strokeWidth={1.5} />
        );
        
        // 4. Labels
        elements.push(
          <text key="p1-label" x={x1} y={y1 - 12} fill={color} fontSize="11" fontWeight="bold" textAnchor="middle">P1</text>
        );
        elements.push(
          <text key="p2-label" x={x2} y={y2 - 12} fill={color} fontSize="11" fontWeight="bold" textAnchor="middle">P2</text>
        );
        elements.push(
          <text key="v-label" x={xV} y={yV + 16} fill="#00bfff" fontSize="10" fontWeight="bold" textAnchor="middle">V</text>
        );
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('range') || patternType.includes('channel')) {
        const bounds = renderContract.bounds || {};
        const boundaries = meta.boundaries || {};
        
        const resistance = bounds.top || meta.resistance || boundaries.upper?.y1;
        const support = bounds.bottom || meta.support || boundaries.lower?.y1;
        const startTime = boundaries.upper?.x1 || boundaries.lower?.x1;
        const endTime = boundaries.upper?.x2 || boundaries.lower?.x2;
        
        if (!resistance || !support || !startTime || !endTime) return [];
        
        const xStart = toX(startTime);
        const xEnd = toX(endTime);
        const yTop = toY(resistance);
        const yBot = toY(support);
        
        if ([xStart, xEnd, yTop, yBot].some(v => v === null)) return [];
        
        const elements = [];
        
        // Rectangle
        elements.push(
          <rect
            key="box"
            x={xStart}
            y={yTop}
            width={xEnd - xStart}
            height={yBot - yTop}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="#3b82f6"
            strokeWidth={2}
          />
        );
        
        // R/S labels
        elements.push(
          <text key="r-label" x={xEnd + 8} y={yTop + 4} fill="#ef4444" fontSize="11" fontWeight="bold">R</text>
        );
        elements.push(
          <text key="s-label" x={xEnd + 8} y={yBot + 4} fill="#22c55e" fontSize="11" fontWeight="bold">S</text>
        );
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // TRIANGLE / WEDGE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('triangle') || patternType.includes('wedge')) {
        const boundaries = meta.boundaries || {};
        const upper = boundaries.upper;
        const lower = boundaries.lower;
        
        if (!upper || !lower) return [];
        
        const x1u = toX(upper.x1);
        const y1u = toY(upper.y1);
        const x2u = toX(upper.x2);
        const y2u = toY(upper.y2);
        const x1l = toX(lower.x1);
        const y1l = toY(lower.y1);
        const x2l = toX(lower.x2);
        const y2l = toY(lower.y2);
        
        if ([x1u, y1u, x2u, y2u, x1l, y1l, x2l, y2l].some(v => v === null)) return [];
        
        const color = patternType.includes('wedge') 
          ? (patternType.includes('falling') ? '#22c55e' : '#ef4444')
          : '#00bfff';
        
        const elements = [];
        
        // Upper line
        elements.push(
          <line key="upper" x1={x1u} y1={y1u} x2={x2u} y2={y2u} stroke={color} strokeWidth={2.5} />
        );
        
        // Lower line
        elements.push(
          <line key="lower" x1={x1l} y1={y1l} x2={x2l} y2={y2l} stroke={color} strokeWidth={2.5} />
        );
        
        return elements;
      }
      
      return [];
      
    } catch (err) {
      console.error('[PatternSVGOverlay] Error:', err);
      return [];
    }
  }, [chart, priceSeries, renderContract]);
  
  // Update on chart changes
  useEffect(() => {
    if (!chart || !priceSeries || !renderContract) {
      setSvgElements([]);
      return;
    }
    
    const update = () => {
      const elements = buildElements();
      setSvgElements(elements);
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
  }, [chart, priceSeries, renderContract, buildElements]);
  
  // Don't render if no elements
  if (!svgElements || svgElements.length === 0) {
    return null;
  }
  
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
        zIndex: 50,
      }}
    >
      {svgElements}
    </svg>
  );
};

export default PatternSVGOverlay;
