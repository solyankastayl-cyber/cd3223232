/**
 * PatternSVGOverlay.jsx — МИНИМАЛИСТИЧНАЯ ВЕРСИЯ
 * 
 * Double Top:
 * - M-shape (P1 → V → P2)
 * - Neckline
 * - Косая стрелка к target (вправо-вниз)
 * - Target line до края + цена + %
 * 
 * БЕЗ:
 * - Probability box
 * - Invalid line
 * - Лишних элементов
 */

import React, { useEffect, useState, useCallback } from 'react';

const PatternSVGOverlay = ({ chart, priceSeries, pattern, renderContract }) => {
  const [svgElements, setSvgElements] = useState([]);
  
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
      
      // Get chart width for extending lines to edge
      const chartWidth = chart.timeScale().width() || 800;
      
      const patternType = renderContract.type || '';
      const anchors = renderContract.anchors || {};
      const meta = renderContract.meta || {};
      
      // ═══════════════════════════════════════════════════════════════
      // DOUBLE TOP / DOUBLE BOTTOM
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        const isTop = patternType === 'double_top';
        
        // Get anchor points
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
        
        // Normalize peaks to same level
        const avgPeakPrice = (p1.price + p2.price) / 2;
        
        // Neckline
        const necklinePrice = valley?.price || meta.neckline || 
          (isTop ? avgPeakPrice * 0.95 : avgPeakPrice * 1.05);
        
        // Valley
        if (!valley) {
          valley = {
            time: (p1.time + p2.time) / 2,
            price: necklinePrice
          };
        }
        
        // Target calculation (measured move)
        const height = Math.abs(avgPeakPrice - necklinePrice);
        const targetPrice = isTop 
          ? necklinePrice - height
          : necklinePrice + height;
        
        // Calculate % move
        const percentMove = ((targetPrice - necklinePrice) / necklinePrice * 100).toFixed(1);
        
        // Convert to screen coordinates
        const x1 = toX(p1.time);
        const y1 = toY(avgPeakPrice);
        const xV = toX(valley.time);
        const yV = toY(valley.price);
        const x2 = toX(p2.time);
        const y2 = toY(avgPeakPrice);
        const yNeck = toY(necklinePrice);
        const yTarget = toY(targetPrice);
        
        if ([x1, y1, xV, yV, x2, y2, yNeck].some(v => v === null || v === undefined)) {
          return [];
        }
        
        const elements = [];
        const bearishColor = '#ef4444';
        const bullishColor = '#22c55e';
        const necklineColor = '#00bfff';
        const mainColor = isTop ? bearishColor : bullishColor;
        
        // ═══════════════════════════════════════════════════════════
        // 1. M-SHAPE (P1 → Valley → P2)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <polyline
            key="mshape"
            points={`${x1},${y1} ${xV},${yV} ${x2},${y2}`}
            fill="none"
            stroke={mainColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 2. NECKLINE (до края графика)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="neckline"
            x1={Math.min(x1, xV) - 20}
            y1={yNeck}
            x2={chartWidth}
            y2={yNeck}
            stroke={necklineColor}
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 3. TARGET LINE (до края графика + цена + %)
        // ═══════════════════════════════════════════════════════════
        if (yTarget !== null) {
          // Target line extending to chart edge
          elements.push(
            <line
              key="target-line"
              x1={x2}
              y1={yTarget}
              x2={chartWidth}
              y2={yTarget}
              stroke={mainColor}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          );
          
          // Target label at right edge
          elements.push(
            <text
              key="target-label"
              x={chartWidth - 5}
              y={yTarget - 5}
              fill={mainColor}
              fontSize="11"
              fontWeight="bold"
              textAnchor="end"
            >
              {targetPrice.toFixed(0)} ({percentMove}%)
            </text>
          );
          
          // ═══════════════════════════════════════════════════════════
          // 4. КОСАЯ СТРЕЛКА (вправо-вниз или вправо-вверх)
          // ═══════════════════════════════════════════════════════════
          const arrowStartX = x2 + 15;
          const arrowStartY = yNeck;
          const arrowEndX = x2 + 60;
          const arrowEndY = yTarget;
          
          // Arrow line
          elements.push(
            <line
              key="arrow-line"
              x1={arrowStartX}
              y1={arrowStartY}
              x2={arrowEndX}
              y2={arrowEndY}
              stroke={mainColor}
              strokeWidth={2}
            />
          );
          
          // Arrow head (small triangle)
          const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
          const headLen = 8;
          const head1X = arrowEndX - headLen * Math.cos(angle - Math.PI / 6);
          const head1Y = arrowEndY - headLen * Math.sin(angle - Math.PI / 6);
          const head2X = arrowEndX - headLen * Math.cos(angle + Math.PI / 6);
          const head2Y = arrowEndY - headLen * Math.sin(angle + Math.PI / 6);
          
          elements.push(
            <polygon
              key="arrow-head"
              points={`${arrowEndX},${arrowEndY} ${head1X},${head1Y} ${head2X},${head2Y}`}
              fill={mainColor}
            />
          );
        }
        
        // ═══════════════════════════════════════════════════════════
        // 5. MARKERS (P1, V, P2) — маленькие
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <circle key="p1-marker" cx={x1} cy={y1} r={4} fill={mainColor} stroke="#fff" strokeWidth={1.5} />
        );
        elements.push(
          <circle key="p2-marker" cx={x2} cy={y2} r={4} fill={mainColor} stroke="#fff" strokeWidth={1.5} />
        );
        elements.push(
          <circle key="valley-marker" cx={xV} cy={yV} r={3} fill={necklineColor} stroke="#fff" strokeWidth={1} />
        );
        
        // Labels (compact)
        elements.push(
          <text key="p1-label" x={x1} y={y1 - 10} fill={mainColor} fontSize="10" fontWeight="bold" textAnchor="middle">P1</text>
        );
        elements.push(
          <text key="p2-label" x={x2} y={y2 - 10} fill={mainColor} fontSize="10" fontWeight="bold" textAnchor="middle">P2</text>
        );
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE — минималистичный
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
        
        // Box
        elements.push(
          <rect
            key="box"
            x={xStart}
            y={yTop}
            width={xEnd - xStart}
            height={yBot - yTop}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
            strokeWidth={1.5}
            rx={2}
          />
        );
        
        // Extend lines to edge
        elements.push(
          <line key="r-line" x1={xEnd} y1={yTop} x2={chartWidth} y2={yTop} stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" />
        );
        elements.push(
          <line key="s-line" x1={xEnd} y1={yBot} x2={chartWidth} y2={yBot} stroke="#22c55e" strokeWidth={1} strokeDasharray="4 2" />
        );
        
        // Price labels at edge
        elements.push(
          <text key="r-price" x={chartWidth - 5} y={yTop - 3} fill="#ef4444" fontSize="10" textAnchor="end">{resistance.toFixed(0)}</text>
        );
        elements.push(
          <text key="s-price" x={chartWidth - 5} y={yBot + 12} fill="#22c55e" fontSize="10" textAnchor="end">{support.toFixed(0)}</text>
        );
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // TRIANGLE / WEDGE — минималистичный
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
          : '#3b82f6';
        
        const elements = [];
        
        // Lines only (no fill)
        elements.push(
          <line key="upper" x1={x1u} y1={y1u} x2={x2u} y2={y2u} stroke={color} strokeWidth={2} />
        );
        elements.push(
          <line key="lower" x1={x1l} y1={y1l} x2={x2l} y2={y2l} stroke={color} strokeWidth={2} />
        );
        
        return elements;
      }
      
      return [];
      
    } catch (err) {
      console.error('[PatternSVGOverlay] Error:', err);
      return [];
    }
  }, [chart, priceSeries, renderContract]);
  
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
