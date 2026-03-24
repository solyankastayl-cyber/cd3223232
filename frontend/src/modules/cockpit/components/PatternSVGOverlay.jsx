/**
 * PatternSVGOverlay.jsx — ПРАВИЛЬНЫЙ DOUBLE TOP
 * 
 * Логика:
 * 1. P1, V — реальные точки
 * 2. P2 — ПРОЕКЦИЯ (симметрично P1 относительно V по времени)
 * 3. Линия от P2 к neckline (завершение фигуры)
 * 4. Стрелка prediction от neckline к target
 * 
 * Структура:
 *   P1 -------- P2
 *    \        /
 *     \      /
 *      \    /
 *       \  /
 *        V
 *        |
 *        ↓ target
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
      // DOUBLE TOP — ПОЛНАЯ ФИГУРА
      // ═══════════════════════════════════════════════════════════════
      if (patternType === 'double_top' || patternType === 'double_bottom') {
        const isTop = patternType === 'double_top';
        
        // Получаем точки
        let p1, valley, p2;
        let p2IsProjected = false; // P2 спроецирован или реальный?
        
        if (anchors.p1 && anchors.p2 && anchors.valley) {
          // Все три точки есть
          p1 = anchors.p1;
          p2 = anchors.p2;
          valley = anchors.valley;
        } else if (anchors.p1 && anchors.valley) {
          // Есть P1 и V — проецируем P2 симметрично
          p1 = anchors.p1;
          valley = anchors.valley;
          
          // P2 симметрично P1 относительно V по времени
          const timeDiff = valley.time - p1.time;
          p2 = {
            time: valley.time + timeDiff,
            price: p1.price // Та же цена (double = две одинаковые вершины)
          };
          p2IsProjected = true;
        } else if (Array.isArray(renderContract.anchors) && renderContract.anchors.length >= 2) {
          const arr = renderContract.anchors;
          const sorted = [...arr].sort((a, b) => isTop ? b.price - a.price : a.price - b.price);
          const peaks = sorted.slice(0, 2).sort((a, b) => a.time - b.time);
          p1 = peaks[0];
          p2 = peaks[1] || null;
          
          // Valley — самая низкая точка между пиками (или создаём)
          const valleyPoints = arr.filter(a => a.time > p1.time && (!p2 || a.time < p2.time));
          if (valleyPoints.length > 0) {
            valley = valleyPoints.reduce((min, p) => 
              isTop ? (p.price < min.price ? p : min) : (p.price > min.price ? p : min), 
              valleyPoints[0]
            );
          }
        }
        
        if (!p1) return [];
        
        // Если нет valley — создаём
        if (!valley) {
          const necklinePrice = meta.neckline || (isTop ? p1.price * 0.95 : p1.price * 1.05);
          valley = {
            time: p2 ? (p1.time + p2.time) / 2 : p1.time + 50,
            price: necklinePrice
          };
        }
        
        // Если нет P2 — проецируем симметрично
        if (!p2) {
          const timeDiff = valley.time - p1.time;
          p2 = {
            time: valley.time + timeDiff,
            price: p1.price
          };
          p2IsProjected = true;
        }
        
        // Нормализуем P1 и P2 на один уровень
        const peakPrice = (p1.price + p2.price) / 2;
        const necklinePrice = valley.price;
        
        // Target (measured move)
        const height = Math.abs(peakPrice - necklinePrice);
        const targetPrice = isTop ? necklinePrice - height : necklinePrice + height;
        
        // Конвертируем в координаты
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
        const mainColor = isTop ? '#ef4444' : '#22c55e';
        const projectedColor = '#888'; // Серый для проекции
        
        // ═══════════════════════════════════════════════════════════
        // 1. ЛЕВАЯ СТОРОНА M (P1 → V) — реальная
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="left-side"
            x1={x1}
            y1={y1}
            x2={xV}
            y2={yV}
            stroke={mainColor}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 2. ПРАВАЯ СТОРОНА M (V → P2) — реальная или проекция
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="right-side"
            x1={xV}
            y1={yV}
            x2={x2}
            y2={y2}
            stroke={p2IsProjected ? projectedColor : mainColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={p2IsProjected ? "6 4" : "none"}
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 3. ГОРИЗОНТАЛЬ (P1 — P2) — уровень вершин
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="top-level"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={mainColor}
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 4. ЛИНИЯ ОТ P2 К NECKLINE (завершение фигуры)
        // ═══════════════════════════════════════════════════════════
        elements.push(
          <line
            key="completion-line"
            x1={x2}
            y1={y2}
            x2={x2}
            y2={yV}
            stroke={projectedColor}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        );
        
        // ═══════════════════════════════════════════════════════════
        // 5. СТРЕЛКА PREDICTION (от neckline к target)
        // Косая вправо-вниз
        // ═══════════════════════════════════════════════════════════
        if (yTarget !== null) {
          const arrowStartX = x2 + 5;
          const arrowStartY = yV;
          const arrowEndX = x2 + 50;
          const arrowEndY = yTarget;
          
          // Линия стрелки
          elements.push(
            <line
              key="prediction-line"
              x1={arrowStartX}
              y1={arrowStartY}
              x2={arrowEndX}
              y2={arrowEndY}
              stroke={mainColor}
              strokeWidth={2}
            />
          );
          
          // Наконечник стрелки
          const angle = Math.atan2(arrowEndY - arrowStartY, arrowEndX - arrowStartX);
          const headLen = 10;
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
          
          // Target цена (без лишнего)
          elements.push(
            <text
              key="target-price"
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
        
        // ═══════════════════════════════════════════════════════════
        // 6. МАРКЕРЫ P1, V, P2
        // ═══════════════════════════════════════════════════════════
        // P1 (реальный)
        elements.push(
          <circle key="p1" cx={x1} cy={y1} r={5} fill={mainColor} stroke="#fff" strokeWidth={2} />
        );
        elements.push(
          <text key="p1-label" x={x1} y={y1 - 12} fill={mainColor} fontSize="11" fontWeight="bold" textAnchor="middle">P1</text>
        );
        
        // V (реальный или вычисленный)
        elements.push(
          <circle key="valley" cx={xV} cy={yV} r={4} fill={mainColor} stroke="#fff" strokeWidth={1.5} opacity={0.8} />
        );
        
        // P2 (реальный или проекция)
        elements.push(
          <circle 
            key="p2" 
            cx={x2} 
            cy={y2} 
            r={5} 
            fill={p2IsProjected ? "none" : mainColor} 
            stroke={p2IsProjected ? projectedColor : "#fff"} 
            strokeWidth={2}
            strokeDasharray={p2IsProjected ? "3 2" : "none"}
          />
        );
        elements.push(
          <text 
            key="p2-label" 
            x={x2} 
            y={y2 - 12} 
            fill={p2IsProjected ? projectedColor : mainColor} 
            fontSize="11" 
            fontWeight="bold" 
            textAnchor="middle"
          >
            P2{p2IsProjected ? "?" : ""}
          </text>
        );
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // RANGE — просто box
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
        
        return elements;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // TRIANGLE / WEDGE — две линии
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
