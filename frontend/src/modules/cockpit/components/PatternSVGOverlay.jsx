/**
 * PatternSVGOverlay.jsx — ПРАВИЛЬНЫЙ ТЕХАНАЛИЗ
 * 
 * Double Top по Bulkowski:
 * - Две вершины на ОДНОМ уровне
 * - Valley между ними
 * - Neckline = уровень valley
 * - Target = neckline - (high - neckline)
 * - Вероятность: 65-75% вниз, 25-35% вверх
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
      
      const patternType = renderContract.type || '';
      const anchors = renderContract.anchors || {};
      const meta = renderContract.meta || {};
      
      // ═══════════════════════════════════════════════════════════════
      // DOUBLE TOP (правильный теханализ)
      // 
      // Структура:
      //    P1          P2
      //     ↑           ↑    ← две вершины на ОДНОМ уровне
      //    /\    V    /\
      //   /  \  ↓    /  \
      //  /    \/    /    \
      // ─────────────────── neckline (уровень V)
      //           ↓
      //        TARGET (neckline - height)
      //
      // Вероятность: 65-75% вниз, 25-35% вверх
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
        
        // ═══════════════════════════════════════════════════════════
        // НОРМАЛИЗАЦИЯ: P1 и P2 должны быть на ОДНОМ уровне!
        // Это ключевое свойство Double Top
        // ═══════════════════════════════════════════════════════════
        const avgPeakPrice = (p1.price + p2.price) / 2;
        
        // Neckline = valley level
        const necklinePrice = valley?.price || meta.neckline || 
          (isTop ? avgPeakPrice * 0.95 : avgPeakPrice * 1.05);
        
        // Create valley if not provided (между P1 и P2)
        if (!valley) {
          valley = {
            time: (p1.time + p2.time) / 2,
            price: necklinePrice
          };
        }
        
        // ═══════════════════════════════════════════════════════════
        // РАСЧЁТ TARGET (measured move)
        // Target = neckline - (peak - neckline)
        // ═══════════════════════════════════════════════════════════
        const height = Math.abs(avgPeakPrice - necklinePrice);
        const targetPrice = isTop 
          ? necklinePrice - height  // Target вниз для double top
          : necklinePrice + height; // Target вверх для double bottom
        
        // Invalidation level (слом фигуры)
        const invalidationPrice = isTop
          ? avgPeakPrice * 1.01  // Выше пиков = слом
          : avgPeakPrice * 0.99;
        
        // Convert to screen coordinates
        // Используем НОРМАЛИЗОВАННЫЙ уровень для P1 и P2
        const x1 = toX(p1.time);
        const y1 = toY(avgPeakPrice); // Нормализованный уровень!
        const xV = toX(valley.time);
        const yV = toY(valley.price);
        const x2 = toX(p2.time);
        const y2 = toY(avgPeakPrice); // Нормализованный уровень!
        const yNeck = toY(necklinePrice);
        const yTarget = toY(targetPrice);
        const yInvalid = toY(invalidationPrice);
        
        // Validate coordinates
        if ([x1, y1, xV, yV, x2, y2, yNeck].some(v => v === null || v === undefined)) {
          return [];
        }
        
        const elements = [];
        const bearishColor = '#ef4444';
        const bullishColor = '#22c55e';
        const necklineColor = '#00bfff';
        const mainColor = isTop ? bearishColor : bullishColor;
        
        // ═══════════════════════════════════════════════════════════
        // 1. RESISTANCE LINE (уровень двух вершин)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="resistance"
            x1={x1 - 30}
            y1={y1}
            x2={x2 + 30}
            y2={y2}
            stroke={mainColor}
            strokeWidth={2}
            strokeDasharray="4 2"
            opacity={0.7}
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 2. M-SHAPE (P1 → Valley → P2)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <polyline
            key="mshape"
            points={`${x1},${y1} ${xV},${yV} ${x2},${y2}`}
            fill="none"
            stroke={mainColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 3. NECKLINE (уровень подтверждения)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="neckline"
            x1={x1 - 50}
            y1={yNeck}
            x2={x2 + 80}
            y2={yNeck}
            stroke={necklineColor}
            strokeWidth={2}
            strokeDasharray="8 4"
          />
        );
        
        // Neckline label
        elements.push(
          <text
            key="neckline-label"
            x={x2 + 85}
            y={yNeck + 4}
            fill={necklineColor}
            fontSize="10"
            fontWeight="bold"
          >
            NECKLINE
          </text>
        );
        
        // ═══════════════════════════════════════════════════════════
        // 4. TARGET PROJECTION (measured move)
        // ═══════════════════════════════════════════════════════════
        if (yTarget !== null) {
          // Arrow down to target
          const arrowX = x2 + 20;
          
          elements.push(
            <line
              key="target-line"
              x1={arrowX}
              y1={yNeck}
              x2={arrowX}
              y2={yTarget}
              stroke={mainColor}
              strokeWidth={2}
              markerEnd="url(#arrow-down)"
            />
          );
          
          // Target zone
          elements.push(
            <rect
              key="target-zone"
              x={x1}
              y={yTarget - 5}
              width={x2 - x1 + 40}
              height={10}
              fill={mainColor}
              opacity={0.2}
              rx={3}
            />
          );
          
          // Target label
          elements.push(
            <text
              key="target-label"
              x={arrowX + 10}
              y={yTarget + 4}
              fill={mainColor}
              fontSize="11"
              fontWeight="bold"
            >
              TARGET ({targetPrice.toFixed(0)})
            </text>
          );
        }
        
        // ═══════════════════════════════════════════════════════════
        // 5. INVALIDATION LEVEL (слом фигуры)
        // ═══════════════════════════════════════════════════════════
        if (yInvalid !== null) {
          elements.push(
            <line
              key="invalid-line"
              x1={x1 - 20}
              y1={yInvalid}
              x2={x2 + 50}
              y2={yInvalid}
              stroke={bullishColor}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.6}
            />
          );
          
          elements.push(
            <text
              key="invalid-label"
              x={x2 + 55}
              y={yInvalid + 4}
              fill={bullishColor}
              fontSize="9"
            >
              INVALID
            </text>
          );
        }
        
        // ═══════════════════════════════════════════════════════════
        // 6. ВЕРОЯТНОСТИ (по Bulkowski)
        // ═══════════════════════════════════════════════════════════
        const probDown = isTop ? "70%" : "30%";
        const probUp = isTop ? "30%" : "70%";
        
        // Probability box
        const boxX = x2 + 60;
        const boxY = (y1 + yNeck) / 2 - 25;
        
        elements.push(
          <rect
            key="prob-box"
            x={boxX}
            y={boxY}
            width={70}
            height={50}
            fill="#1a1a2e"
            stroke="#333"
            strokeWidth={1}
            rx={4}
            opacity={0.9}
          />
        );
        
        elements.push(
          <text key="prob-title" x={boxX + 5} y={boxY + 14} fill="#888" fontSize="9">
            Probability
          </text>
        );
        
        elements.push(
          <text key="prob-down" x={boxX + 5} y={boxY + 28} fill={bearishColor} fontSize="11" fontWeight="bold">
            ↓ {probDown}
          </text>
        );
        
        elements.push(
          <text key="prob-up" x={boxX + 5} y={boxY + 42} fill={bullishColor} fontSize="11" fontWeight="bold">
            ↑ {probUp}
          </text>
        );
        
        // ═══════════════════════════════════════════════════════════
        // 7. MARKERS (P1, V, P2)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <circle key="p1-marker" cx={x1} cy={y1} r={6} fill={mainColor} stroke="#fff" strokeWidth={2} />
        );
        elements.push(
          <circle key="p2-marker" cx={x2} cy={y2} r={6} fill={mainColor} stroke="#fff" strokeWidth={2} />
        );
        elements.push(
          <circle key="valley-marker" cx={xV} cy={yV} r={5} fill={necklineColor} stroke="#fff" strokeWidth={2} />
        );
        
        // Labels
        elements.push(
          <text key="p1-label" x={x1} y={y1 - 14} fill={mainColor} fontSize="12" fontWeight="bold" textAnchor="middle">P1</text>
        );
        elements.push(
          <text key="p2-label" x={x2} y={y2 - 14} fill={mainColor} fontSize="12" fontWeight="bold" textAnchor="middle">P2</text>
        );
        elements.push(
          <text key="v-label" x={xV} y={yV + 20} fill={necklineColor} fontSize="11" fontWeight="bold" textAnchor="middle">V</text>
        );
        
        // ═══════════════════════════════════════════════════════════
        // 8. ARROW MARKER DEFINITION
        // ═══════════════════════════════════════════════════════════
        elements.unshift(
          <defs key="defs">
            <marker
              id="arrow-down"
              markerWidth="10"
              markerHeight="10"
              refX="5"
              refY="5"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 Z" fill={mainColor} />
            </marker>
          </defs>
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
        
        // Range target calculation
        const rangeHeight = Math.abs(resistance - support);
        const targetUp = resistance + rangeHeight;
        const targetDown = support - rangeHeight;
        
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
            rx={3}
          />
        );
        
        // R/S labels
        elements.push(
          <text key="r-label" x={xEnd + 8} y={yTop + 4} fill="#ef4444" fontSize="11" fontWeight="bold">R</text>
        );
        elements.push(
          <text key="s-label" x={xEnd + 8} y={yBot + 4} fill="#22c55e" fontSize="11" fontWeight="bold">S</text>
        );
        
        // Target projections
        const yTargetUp = toY(targetUp);
        const yTargetDown = toY(targetDown);
        
        if (yTargetUp !== null) {
          elements.push(
            <line key="target-up" x1={xEnd + 15} y1={yTop} x2={xEnd + 15} y2={yTargetUp} stroke="#22c55e" strokeWidth={2} strokeDasharray="4 2" />
          );
        }
        
        if (yTargetDown !== null) {
          elements.push(
            <line key="target-down" x1={xEnd + 25} y1={yBot} x2={xEnd + 25} y2={yTargetDown} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" />
          );
        }
        
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
        
        // Fill
        elements.push(
          <polygon
            key="fill"
            points={`${x1u},${y1u} ${x2u},${y2u} ${x2l},${y2l} ${x1l},${y1l}`}
            fill={color}
            opacity={0.1}
          />
        );
        
        // Lines
        elements.push(
          <line key="upper" x1={x1u} y1={y1u} x2={x2u} y2={y2u} stroke={color} strokeWidth={2.5} />
        );
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
