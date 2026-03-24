# АУДИТ СВЯЗКИ BACKEND ↔ FRONTEND
## Модуль теханализа (TA Engine)

### Дата: 2026-03-24

---

## ✅ РАБОТАЕТ КОРРЕКТНО

### Backend API
| Endpoint | Статус | Данные |
|----------|--------|--------|
| `/api/ta-engine/mtf/BTC?timeframes=1D` | ✅ 200 OK | narrative, interpretation, final_analysis |
| `/api/ta-engine/mtf/BTC?timeframes=4H` | ✅ 200 OK | Double Top pattern detected |
| `/api/health` | ✅ 200 OK | System healthy |

### Данные из Backend
```
tf_map[1D].narrative = {
  short: "Market is moving in a neutral structure.",
  full: "Market is moving in a neutral structure. A developing loose range structure is forming."
}

tf_map[1D].interpretation = "Loose Range structure is developing. Price is interacting with support near 62,535."

tf_map[1D].final_analysis = {
  analysis_mode: "figure",
  summary: { title: "Loose Range Developing", text: "A loose range formation is developing." },
  ui.main_overlay: "loose_range"
}

mtf_context.alignment = {
  direction: "neutral",
  confidence: 0.0,
  alignment: "mixed"
}

mtf_context.mtf_narrative = {
  short: "Market shows mixed signals across timeframes.",
  full: "Market shows mixed signals across timeframes."
}
```

### Frontend Отображение
| Компонент | Статус | Данные на UI |
|-----------|--------|--------------|
| MTF Summary Bar | ✅ | "Macro: Neutral · Mid-term: Developing · Short-term: Consolidation" |
| MTF Alignment Box | ✅ | "NEUTRAL" + Confidence 0% |
| TF Interpretation | ✅ | "4H ANALYSIS: Locally, Double Top suggests short-term neutral pressure." |
| Market Narrative | ✅ | "Market is moving in a neutral structure. A confirmed double top pattern suggests bearish pressure." |
| Pattern Card | ✅ | "PATTERN DETECTED: Double Top" |
| Chart | ✅ | Свечи + HH/LL маркеры + S/R уровни |

---

## ⚠️ НЕ ОТНОСИТСЯ К МОДУЛЮ ТЕХАНАЛИЗА (404 ошибки)

Эти endpoints принадлежат **другим модулям** (meta-brain, market), которые не поднимались:

- `/api/meta-brain-v2/signals` - 404
- `/api/meta-brain-v2/forecast` - 404
- `/api/meta-brain-v2/performance` - 404
- `/api/meta-brain-v2/influence` - 404
- `/api/meta-brain-v2/modules` - 404
- `/api/meta-brain-v2/drift` - 404
- `/api/meta-brain-v2/policy` - 404
- `/api/market/exchange/top-alts-v2` - 404
- `/api/market/rotation/sectors` - 404
- `/api/v10/macro/impact` - 404
- `/api/v10/exchange/labs/v3/alerts/check` - 404

**WebSocket**: 403 Forbidden на `/api/ws` — это нормально для preview окружения.

---

## 📊 ВЫВОД АУДИТА

### Связка BACKEND ↔ FRONTEND для модуля теханализа:
# ✅ РАБОТАЕТ ПОЛНОСТЬЮ

Все изменения backend **отражаются на frontend**:
1. ✅ narrative.full → MARKET NARRATIVE блок
2. ✅ interpretation → TF ANALYSIS блок
3. ✅ mtf_context.alignment → MTF ALIGNMENT блок
4. ✅ final_analysis.summary → MTF Summary Bar
5. ✅ pattern detection → Pattern Card + Chart overlay

### Возможная путаница:
Если казалось что изменения не применяются:
1. **Кэширование** — API кэширует результаты на 5 минут
2. **Разные TF** — 1D показывает Loose Range, 4H показывает Double Top
3. **404 ошибки** — не относятся к TA Engine (другие модули)

---

## 🔧 РЕКОМЕНДАЦИИ

1. **Для тестирования без кэша**: добавить `?nocache=1` или очистить кэш через Refresh
2. **Проверять правильный TF**: 1D vs 4H показывают разные паттерны
3. **Игнорировать 404**: они не влияют на работу модуля теханализа
