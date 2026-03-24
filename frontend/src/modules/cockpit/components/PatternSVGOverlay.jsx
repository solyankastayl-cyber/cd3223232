/**
 * PatternSVGOverlay.jsx
 * 
 * SVG layer поверх lightweight-charts для рисования реальных фигур:
 * - Double Top/Bottom — polyline
 * - Wedge/Triangle — две диагональные линии
 * - Range — прямоугольник
 * 
 * Использует chart.timeScale().timeToCoordinate() для конвертации time → x
 * Использует chart.priceScale().priceToCoordinate() для конвертации price → y
 */

import React, { useEffect, useState, useCallback } from 'react';

const PatternSVGOverlay = ({ chart, priceSeries, pattern, renderContract }) => {
  const [svgData, setSvgData] = useState(null);
  
  // Recalculate coordinates when chart changes (scroll/zoom)
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
      
      // Helper: convert price to Y coordinate (use series API)
      const toY = (price) => {
        try {
          const y = priceSeries.priceToCoordinate(price);
          return y !== null ? y : null;
        } catch (e) {
          return null;
        }
      };
      
      const patternType = renderContract.type;
      const anchors = renderContract.anchors || [];
      const boundaries = renderContract.meta?.boundaries || {};
      const neckline = boundaries.neckline || renderContract.meta?.neckline;
      const mode = renderContract.mode || 'strict';
      const bias = renderContract.bias || 'neutral';
      
      // Color based on bias
      const color = bias === 'bullish' ? '#22c55e' : 
                   bias === 'bearish' ? '#ef4444' : 
                   '#3b82f6';
      
      const strokeStyle = mode === 'loose' ? '4 4' : 'none';
      const strokeWidth = mode === 'loose' ? 1.5 : 2.5;
      
      // ═══════════════════════════════════════════════════════════════
      // DOUBLE TOP / DOUBLE BOTTOM
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        if (anchors.length < 2 || !neckline) return null;
        
        // Sort by price to find peaks and valley
        const sortedByPrice = [...anchors].sort((a, b) => 
          patternType === 'double_top' ? b.price - a.price : a.price - b.price
        );
        
        // Get two peaks (highest for double_top, lowest for double_bottom)
        const peaks = sortedByPrice.slice(0, 2).sort((a, b) => a.time - b.time);
        const p1 = peaks[0];
        const p2 = peaks[1];
        
        // Valley is anchor at neckline level or synthetic
        let valley = anchors.find(a => Math.abs(a.price - neckline) < (Math.abs(p1.price - neckline) * 0.1));
        if (!valley) {
          valley = {
            time: Math.floor((p1.time + p2.time) / 2),
            price: neckline
          };
        }
        
        // Convert to screen coordinates
        const x1 = toX(p1.time);
        const y1 = toY(p1.price);
        const xV = toX(valley.time);
        const yV = toY(valley.price);
        const x2 = toX(p2.time);
        const y2 = toY(p2.price);
        const yNeck = toY(neckline);
        
        // Check if coordinates are valid
        if ([x1, y1, xV, yV, x2, y2, yNeck].some(v => v === null || v === 0)) return null;
        
        return {
          type: 'double_top',
          elements: [
            // Main polyline: P1 → Valley → P2
            {
              tag: 'polyline',
              props: {
                points: `${x1},${y1} ${xV},${yV} ${x2},${y2}`,
                fill: 'none',
                stroke: color,
                strokeWidth: strokeWidth,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }
            },
            // Neckline (horizontal dashed)
            {
              tag: 'line',
              props: {
                x1: Math.min(x1, x2) - 20,
                y1: yNeck,
                x2: Math.max(x1, x2) + 20,
                y2: yNeck,
                stroke: '#00e5ff',
                strokeWidth: 2,
                strokeDasharray: '6 4',
              }
            },
            // Labels
            {
              tag: 'text',
              props: {
                x: x1,
                y: y1 - 8,
                fill: color,
                fontSize: '11px',
                fontWeight: 'bold',
                textAnchor: 'middle',
              },
              content: 'P1'
            },
            {
              tag: 'text',
              props: {
                x: x2,
                y: y2 - 8,
                fill: color,
                fontSize: '11px',
                fontWeight: 'bold',
                textAnchor: 'middle',
              },
              content: 'P2'
            },
            {
              tag: 'text',
              props: {
                x: xV,
                y: yV + 16,
                fill: '#00e5ff',
                fontSize: '10px',
                fontWeight: 'bold',
                textAnchor: 'middle',
              },
              content: 'Valley'
            },
          ]
        };
      }
      
      // ═══════════════════════════════════════════════════════════════
      // WEDGE / TRIANGLE
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('wedge') || patternType.includes('triangle')) {
        const upper = boundaries.upper;
        const lower = boundaries.lower;
        
        if (!upper || !lower) return null;
        
        const x1U = toX(upper.x1);
        const y1U = toY(upper.y1);
        const x2U = toX(upper.x2);
        const y2U = toY(upper.y2);
        
        const x1L = toX(lower.x1);
        const y1L = toY(lower.y1);
        const x2L = toX(lower.x2);
        const y2L = toY(lower.y2);
        
        if ([x1U, y1U, x2U, y2U, x1L, y1L, x2L, y2L].some(v => v === null || v === 0)) return null;
        
        return {
          type: 'wedge',
          elements: [
            // Upper trendline
            {
              tag: 'line',
              props: {
                x1: x1U,
                y1: y1U,
                x2: x2U,
                y2: y2U,
                stroke: '#ef4444',
                strokeWidth: strokeWidth,
                strokeDasharray: strokeStyle,
              }
            },
            // Lower trendline
            {
              tag: 'line',
              props: {
                x1: x1L,
                y1: y1L,
                x2: x2L,
                y2: y2L,
                stroke: '#22c55e',
                strokeWidth: strokeWidth,
                strokeDasharray: strokeStyle,
              }
            },
            // Fill polygon (optional - semi-transparent)
            {
              tag: 'polygon',
              props: {
                points: `${x1U},${y1U} ${x2U},${y2U} ${x2L},${y2L} ${x1L},${y1L}`,
                fill: `${color}15`,
                stroke: 'none',
              }
            },
          ]
        };
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE / CHANNEL
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('range') || patternType.includes('channel')) {
        const upper = boundaries.upper;
        const lower = boundaries.lower;
        
        if (!upper || !lower) return null;
        
        // For range, use average prices for horizontal lines
        const upperPrice = Math.max(upper.y1, upper.y2);
        const lowerPrice = Math.min(lower.y1, lower.y2);
        
        const xStart = Math.min(toX(upper.x1), toX(lower.x1));
        const xEnd = Math.max(toX(upper.x2), toX(lower.x2));
        const yUpper = toY(upperPrice);
        const yLower = toY(lowerPrice);
        
        if ([xStart, xEnd, yUpper, yLower].some(v => v === null || v === 0)) return null;
        
        return {
          type: 'range',
          elements: [
            // Range rectangle fill
            {
              tag: 'rect',
              props: {
                x: xStart,
                y: yUpper,
                width: xEnd - xStart,
                height: yLower - yUpper,
                fill: `${color}10`,
                stroke: color,
                strokeWidth: strokeWidth,
                strokeDasharray: strokeStyle,
              }
            },
            // Resistance label
            {
              tag: 'text',
              props: {
                x: xEnd + 5,
                y: yUpper + 4,
                fill: '#ef4444',
                fontSize: '10px',
                fontWeight: 'bold',
              },
              content: 'R'
            },
            // Support label
            {
              tag: 'text',
              props: {
                x: xEnd + 5,
                y: yLower + 4,
                fill: '#22c55e',
                fontSize: '10px',
                fontWeight: 'bold',
              },
              content: 'S'
            },
          ]
        };
      }
      
      // ═══════════════════════════════════════════════════════════════
      // HEAD & SHOULDERS
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'head_shoulders' || patternType === 'inverse_head_shoulders') {
        if (anchors.length < 3) return null;
        
        // Sort by time
        const sorted = [...anchors].sort((a, b) => a.time - b.time);
        
        const points = sorted.map(a => `${toX(a.time)},${toY(a.price)}`).join(' ');
        
        return {
          type: 'head_shoulders',
          elements: [
            // Polyline connecting shoulders and head
            {
              tag: 'polyline',
              props: {
                points: points,
                fill: 'none',
                stroke: color,
                strokeWidth: strokeWidth,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
              }
            },
            // Neckline if available
            ...(neckline ? [{
              tag: 'line',
              props: {
                x1: toX(sorted[0].time) - 20,
                y1: toY(neckline),
                x2: toX(sorted[sorted.length - 1].time) + 20,
                y2: toY(neckline),
                stroke: '#00e5ff',
                strokeWidth: 2,
                strokeDasharray: '6 4',
              }
            }] : []),
          ]
        };
      }
      
      return null;
    } catch (e) {
      console.warn('[PatternSVGOverlay] Calculation error:', e);
      return null;
    }
  }, [chart, priceSeries, renderContract]);
  
  // Recalculate on chart changes
  useEffect(() => {
    if (!chart) return;
    
    const update = () => {
      const data = calculateCoordinates();
      setSvgData(data);
    };
    
    // Initial calculation
    update();
    
    // Subscribe to chart updates
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(update);
    timeScale.subscribeVisibleTimeRangeChange(update);
    
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(update);
      timeScale.unsubscribeVisibleTimeRangeChange(update);
    };
  }, [chart, calculateCoordinates]);
  
  if (!svgData || !svgData.elements) return null;
  
  return (
    <svg
      className="pattern-svg-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      {svgData.elements.map((el, idx) => {
        if (el.tag === 'polyline') {
          return <polyline key={idx} {...el.props} />;
        }
        if (el.tag === 'line') {
          return <line key={idx} {...el.props} />;
        }
        if (el.tag === 'polygon') {
          return <polygon key={idx} {...el.props} />;
        }
        if (el.tag === 'rect') {
          return <rect key={idx} {...el.props} />;
        }
        if (el.tag === 'text') {
          return <text key={idx} {...el.props}>{el.content}</text>;
        }
        if (el.tag === 'circle') {
          return <circle key={idx} {...el.props} />;
        }
        return null;
      })}
    </svg>
  );
};

export default PatternSVGOverlay;
