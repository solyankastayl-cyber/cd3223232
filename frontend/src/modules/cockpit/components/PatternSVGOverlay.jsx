/**
 * PatternSVGOverlay.jsx — ЧИСТАЯ ЧЁРНАЯ ФИГУРА
 * 
 * Double Top:
 * - Чёрная M-фигура
 * - Косая стрелка к target
 * - Без лишних элементов
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
      
      const normalizeTime = (t) => {
        if (!t) return t;
        return t > 9999999999 ? Math.floor(t / 1000) : t;
      };
      
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
      // DOUBLE TOP — ЧЁРНАЯ ФИГУРА
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        const isTop = patternType === 'double_top';
        
        let p1, valley, p2;
        let p2IsProjected = false;
        
        if (anchors.p1 && anchors.p2 && anchors.valley) {
          p1 = anchors.p1;
          p2 = anchors.p2;
          valley = anchors.valley;
        } else if (anchors.p1 && anchors.valley) {
          p1 = anchors.p1;
          valley = anchors.valley;
          const timeDiff = valley.time - p1.time;
          p2 = {
            time: valley.time + timeDiff,
            price: p1.price
          };
          p2IsProjected = true;
        } else if (Array.isArray(renderContract.anchors) && renderContract.anchors.length >= 2) {
          const arr = renderContract.anchors;
          const sorted = [...arr].sort((a, b) => isTop ? b.price - a.price : a.price - b.price);
          const peaks = sorted.slice(0, 2).sort((a, b) => a.time - b.time);
          p1 = peaks[0];
          p2 = peaks[1] || null;
          
          const valleyPoints = arr.filter(a => a.time > p1.time && (!p2 || a.time < p2.time));
          if (valleyPoints.length > 0) {
            valley = valleyPoints.reduce((min, p) => 
              isTop ? (p.price < min.price ? p : min) : (p.price > min.price ? p : min), 
              valleyPoints[0]
            );
          }
        }
        
        if (!p1) return [];
        
        if (!valley) {
          const necklinePrice = meta.neckline || (isTop ? p1.price * 0.95 : p1.price * 1.05);
          valley = {
            time: p2 ? (p1.time + p2.time) / 2 : p1.time + 50,
            price: necklinePrice
          };
        }
        
        if (!p2) {
          const timeDiff = valley.time - p1.time;
          p2 = {
            time: valley.time + timeDiff,
            price: p1.price
          };
          p2IsProjected = true;
        }
        
        const peakPrice = (p1.price + p2.price) / 2;
        const necklinePrice = valley.price;
        const height = Math.abs(peakPrice - necklinePrice);
        const targetPrice = isTop ? necklinePrice - height : necklinePrice + height;
        
        const x1 = toX(p1.time);
        const y1 = toY(peakPrice);
        const xV = toX(valley.time);
        const yV = toY(necklinePrice);
        const x2 = toX(p2.time);
        const y2 = toY(peakPrice);
        const yTarget = toY(targetPrice);
        
        if ([x1, y1, xV, yV, x2, y2].some(v => v === null || v === undefined)) {
          return [];
        }
        
        const elements = [];
        
        // ВСЁ ЧЁРНЫМ ЦВЕТОМ
        const mainColor = '#000000';
        const projectedColor = '#666666';
        
        // 1. Левая сторона M (P1 → V)
        elements.push(
          <line
            key="left-side"
            x1={x1}
            y1={y1}
            x2={xV}
            y2={yV}
            stroke={mainColor}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
        
        // 2. Правая сторона M (V → P2)
        elements.push(
          <line
            key="right-side"
            x1={xV}
            y1={yV}
            x2={x2}
            y2={y2}
            stroke={p2IsProjected ? projectedColor : mainColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={p2IsProjected ? "4 3" : "none"}
          />
        );
        
        // 3. Горизонталь P1-P2
        elements.push(
          <line
            key="top-level"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={mainColor}
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.4}
          />
        );
        
        // 4. Линия завершения (P2 → neckline)
        elements.push(
          <line
            key="completion"
            x1={x2}
            y1={y2}
            x2={x2}
            y2={yV}
            stroke={projectedColor}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        );
        
        // 5. Стрелка prediction (от neckline к target)
        if (yTarget !== null) {
          const arrowStartX = x2 + 5;
          const arrowStartY = yV;
          const arrowEndX = x2 + 45;
          const arrowEndY = yTarget;
          
          elements.push(
            <line
              key="prediction"
              x1={arrowStartX}
              y1={arrowStartY}
              x2={arrowEndX}
              y2={arrowEndY}
              stroke={mainColor}
              strokeWidth={2}
            />
          );
          
          // Наконечник
          const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
          const headLen = 8;
          const h1X = arrowEndX - headLen * Math.cos(angle - Math.PI / 6);
          const h1Y = arrowEndY - headLen * Math.sin(angle - Math.PI / 6);
          const h2X = arrowEndX - headLen * Math.cos(angle + Math.PI / 6);
          const h2Y = arrowEndY - headLen * Math.sin(angle + Math.PI / 6);
          
          elements.push(
            <polygon
              key="arrow-head"
              points={`${arrowEndX},${arrowEndY} ${h1X},${h1Y} ${h2X},${h2Y}`}
              fill={mainColor}
            />
          );
          
          // Target цена
          elements.push(
            <text
              key="target"
              x={arrowEndX + 5}
              y={arrowEndY + 4}
              fill={mainColor}
              fontSize="11"
              fontWeight="bold"
            >
              {targetPrice.toFixed(0)}
            </text>
          );
        }
        
        // 6. Маркеры P1, P2
        elements.push(
          <circle key="p1" cx={x1} cy={y1} r={4} fill={mainColor} />
        );
        elements.push(
          <text key="p1-label" x={x1} y={y1 - 8} fill={mainColor} fontSize="10" fontWeight="bold" textAnchor="middle">P1</text>
        );
        
        elements.push(
          <circle 
            key="p2" 
            cx={x2} 
            cy={y2} 
            r={4} 
            fill={p2IsProjected ? "none" : mainColor}
            stroke={mainColor}
            strokeWidth={p2IsProjected ? 2 : 0}
            strokeDasharray={p2IsProjected ? "2 2" : "none"}
          />
        );
        elements.push(
          <text 
            key="p2-label" 
            x={x2} 
            y={y2 - 8} 
            fill={p2IsProjected ? projectedColor : mainColor} 
            fontSize="10" 
            fontWeight="bold" 
            textAnchor="middle"
          >
            P2{p2IsProjected ? "?" : ""}
          </text>
        );
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE — чёрный box
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
        
        return [
          <rect
            key="box"
            x={xStart}
            y={yTop}
            width={xEnd - xStart}
            height={yBot - yTop}
            fill="rgba(0, 0, 0, 0.05)"
            stroke="#000000"
            strokeWidth={2}
            rx={2}
          />
        ];
      }
      
      // ═══════════════════════════════════════════════════════════════
      // TRIANGLE / WEDGE — чёрные линии
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
        
        return [
          <line key="upper" x1={x1u} y1={y1u} x2={x2u} y2={y2u} stroke="#000000" strokeWidth={2} />,
          <line key="lower" x1={x1l} y1={y1l} x2={x2l} y2={y2l} stroke="#000000" strokeWidth={2} />
        ];
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
    
    const update = () => setSvgElements(buildElements());
    update();
    
    const timeScale = chart.timeScale();
    if (timeScale) timeScale.subscribeVisibleTimeRangeChange(update);
    chart.subscribeCrosshairMove(update);
    
    return () => {
      if (timeScale) timeScale.unsubscribeVisibleTimeRangeChange(update);
      chart.unsubscribeCrosshairMove(update);
    };
  }, [chart, priceSeries, renderContract, buildElements]);
  
  if (!svgElements || svgElements.length === 0) return null;
  
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
