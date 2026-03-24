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
      // DOUBLE TOP / DOUBLE BOTTOM (V2 — с нормализацией от backend)
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        // Попробуем получить нормализованные anchors из backend
        const normalizedAnchors = renderContract.anchors || {};
        let p1 = normalizedAnchors.p1;
        let p2 = normalizedAnchors.p2;
        let valley = normalizedAnchors.valley;
        
        // Fallback: старый способ (из массива anchors)
        if (!p1 || !p2) {
          if (anchors.length < 2 || !neckline) return null;
          
          // Sort by price to find peaks and valley
          const sortedByPrice = [...anchors].sort((a, b) => 
            patternType === 'double_top' ? b.price - a.price : a.price - b.price
          );
          
          // Get two peaks (highest for double_top, lowest for double_bottom)
          const peaks = sortedByPrice.slice(0, 2).sort((a, b) => a.time - b.time);
          p1 = peaks[0];
          p2 = peaks[1];
          
          // Valley is anchor at neckline level or synthetic
          valley = anchors.find(a => Math.abs(a.price - neckline) < (Math.abs(p1.price - neckline) * 0.1));
        }
        
        // Если valley нет — создаём синтетический (по центру)
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
        
        // ═══════════════════════════════════════════════════════════
        // ВИЗУАЛЬНЫЕ УЛУЧШЕНИЯ V2
        // ═══════════════════════════════════════════════════════════
        
        // Цвет зависит от типа паттерна
        const patternColor = patternType === 'double_top' ? '#ef4444' : '#22c55e';
        const valleyColor = '#00e5ff';
        
        // Градиент для заливки (опционально)
        const fillId = `fill-${patternType}-${Date.now()}`;
        
        return {
          type: 'double_top',
          elements: [
            // Gradient definition (для заливки)
            {
              tag: 'defs',
              props: {},
              content: null,
              children: [{
                tag: 'linearGradient',
                props: {
                  id: fillId,
                  x1: '0%',
                  y1: '0%',
                  x2: '0%',
                  y2: '100%',
                },
                children: [
                  { tag: 'stop', props: { offset: '0%', stopColor: patternColor, stopOpacity: '0.15' } },
                  { tag: 'stop', props: { offset: '100%', stopColor: patternColor, stopOpacity: '0.02' } },
                ]
              }]
            },
            // Fill area (M-shape с заливкой)
            {
              tag: 'polygon',
              props: {
                points: `${x1},${yNeck} ${x1},${y1} ${xV},${yV} ${x2},${y2} ${x2},${yNeck}`,
                fill: `url(#${fillId})`,
                stroke: 'none',
              }
            },
            // Main polyline: P1 → Valley → P2 (M-форма)
            {
              tag: 'polyline',
              props: {
                points: `${x1},${y1} ${xV},${yV} ${x2},${y2}`,
                fill: 'none',
                stroke: patternColor,
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
                stroke: valleyColor,
                strokeWidth: 2,
                strokeDasharray: '6 4',
              }
            },
            // Peak markers (circles)
            {
              tag: 'circle',
              props: {
                cx: x1,
                cy: y1,
                r: 4,
                fill: patternColor,
                stroke: '#fff',
                strokeWidth: 1.5,
              }
            },
            {
              tag: 'circle',
              props: {
                cx: x2,
                cy: y2,
                r: 4,
                fill: patternColor,
                stroke: '#fff',
                strokeWidth: 1.5,
              }
            },
            // Valley marker
            {
              tag: 'circle',
              props: {
                cx: xV,
                cy: yV,
                r: 3,
                fill: valleyColor,
                stroke: '#fff',
                strokeWidth: 1,
              }
            },
            // Labels
            {
              tag: 'text',
              props: {
                x: x1,
                y: y1 - 12,
                fill: patternColor,
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
                y: y2 - 12,
                fill: patternColor,
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
                y: yV + 18,
                fill: valleyColor,
                fontSize: '10px',
                fontWeight: 'bold',
                textAnchor: 'middle',
              },
              content: 'V'
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
      // RANGE / CHANNEL (V2 — с улучшениями)
      // ═══════════════════════════════════════════════════════════════
      if (patternType.includes('range') || patternType.includes('channel')) {
        const upper = boundaries.upper;
        const lower = boundaries.lower;
        
        if (!upper || !lower) return null;
        
        // Получаем нормализованные bounds если есть
        const bounds = renderContract.bounds || {};
        
        // For range, use normalized prices or fallback to boundaries
        const upperPrice = bounds.top || Math.max(upper.y1, upper.y2);
        const lowerPrice = bounds.bottom || Math.min(lower.y1, lower.y2);
        
        const xStart = Math.min(toX(upper.x1), toX(lower.x1));
        const xEnd = Math.max(toX(upper.x2), toX(lower.x2));
        const yUpper = toY(upperPrice);
        const yLower = toY(lowerPrice);
        
        if ([xStart, xEnd, yUpper, yLower].some(v => v === null || v === 0)) return null;
        
        // Confidence влияет на opacity (нормализован от backend)
        const confidence = renderContract.confidence || 0.5;
        const fillOpacity = Math.min(0.2, confidence * 0.3);
        
        // Touch count для визуализации
        const touches = renderContract.touches || 0;
        const touchLabel = touches > 0 ? `${touches} touches` : '';
        
        return {
          type: 'range',
          elements: [
            // Range rectangle fill с динамической opacity
            {
              tag: 'rect',
              props: {
                x: xStart,
                y: yUpper,
                width: xEnd - xStart,
                height: yLower - yUpper,
                fill: `${color}`,
                fillOpacity: fillOpacity,
                stroke: color,
                strokeWidth: strokeWidth,
                strokeDasharray: strokeStyle,
                rx: 4, // Скруглённые углы
                ry: 4,
              }
            },
            // Upper resistance line (более заметная)
            {
              tag: 'line',
              props: {
                x1: xStart - 10,
                y1: yUpper,
                x2: xEnd + 10,
                y2: yUpper,
                stroke: '#ef4444',
                strokeWidth: 2,
                strokeDasharray: '4 2',
              }
            },
            // Lower support line
            {
              tag: 'line',
              props: {
                x1: xStart - 10,
                y1: yLower,
                x2: xEnd + 10,
                y2: yLower,
                stroke: '#22c55e',
                strokeWidth: 2,
                strokeDasharray: '4 2',
              }
            },
            // Resistance label
            {
              tag: 'text',
              props: {
                x: xEnd + 8,
                y: yUpper + 4,
                fill: '#ef4444',
                fontSize: '11px',
                fontWeight: 'bold',
              },
              content: 'R'
            },
            // Support label
            {
              tag: 'text',
              props: {
                x: xEnd + 8,
                y: yLower + 4,
                fill: '#22c55e',
                fontSize: '11px',
                fontWeight: 'bold',
              },
              content: 'S'
            },
            // Touch count label (если есть)
            ...(touchLabel ? [{
              tag: 'text',
              props: {
                x: (xStart + xEnd) / 2,
                y: (yUpper + yLower) / 2,
                fill: '#64748b',
                fontSize: '9px',
                fontWeight: 'normal',
                textAnchor: 'middle',
                opacity: 0.7,
              },
              content: touchLabel
            }] : []),
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
