# UI/UX Inspiration & Concrete Patterns

## 1. Stack decision (locked)  
We add `ui-ux-pro-max` as a Wave 2 skill, scoped to *enhance* shadcn defaults — not replace them.  
Run **once on Day 2 morning** to generate tailored palette + font pairing.  
Only swaps: accent color, chart palette (5 colors), heading font.  
Do NOT let it generate a full design system that fights shadcn.

## 2. STEAL list — 12 verified patterns

| # | Component | Pattern | Implementation note | Hours |  
|---|---|---|---|---|  
| 1 | Candle chart | Up `#26a69a` / Down `#ef5350` (TradingView standard) | lightweight-charts `upColor`/`downColor` props | 0.25 |  
| 2 | Candle chart | Hover crosshair shows OHLC + change% in top-left overlay | lightweight-charts `subscribeCrosshairMove` → render Card | 1.0 |  
| 3 | Forecast overlay | Semi-transparent fill (10% accent) + dashed median line | Recharts Area (fillOpacity 0.1) + Line (strokeDasharray "4 4") | 1.0 |  
| 4 | Numbers everywhere | Tabular numerals so digits don't reflow on update | Tailwind: `tabular-nums` on every numeric cell | 0.1 |  
| 5 | Holdings P&L | Number flash on update — green/red flash 250ms | Framer Motion `animate={{ backgroundColor }}` | 0.5 |  
| 6 | DAG node | Node Status Indicator (idle/loading/success/error) | React Flow UI drop-in component | 0.5 |  
| 7 | DAG node | Pulse animation: expanding-ring radar-style pulse on active node | Framer Motion `animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}` | 0.5 |  
| 8 | DAG edges | `animated: true` + dashed-line marching when source is running | Set `edge.animated = true` in dag-store on running events | 0.25 |  
| 9 | NL query bar | Suggested-question chips below input | shadcn Badge row, cursor-pointer, click → set query | 0.5 |  
| 10 | News sentiment chip | red-500 / slate-400 / emerald-500 for negative/neutral/positive | shadcn Badge variant | 0.25 |  
| 11 | Audit table | Row click opens side Sheet with full JSON | shadcn Sheet + pre JSON.stringify | 0.5 |  
| 12 | Toasts | Stripe/Vercel-style alert with action button | shadcn useToast() | 0.25 |

## 3. Color palette + typography (locked tokens)

### Background (dark mode default)  
| Layer | Hex | Tailwind |  
|---|---|---|  
| Page background | `#0A0A0A` | `bg-neutral-950` |  
| Surface (cards) | `#171717` | `bg-neutral-900` |  
| Surface elevated | `#262626` | `bg-neutral-800` |  
| Border | `#2E2E2E` | `border-neutral-800` |  
| Foreground primary | `#FAFAFA` | `text-neutral-50` |  
| Foreground muted | `#A3A3A3` | `text-neutral-400` |

### Semantic colors (TradingView-aligned)  
| Use | Hex | Tailwind |  
|---|---|---|  
| Up / positive / bullish | `#26a69a` | `text-[#26a69a]` |  
| Down / negative / bearish | `#ef5350` | `text-[#ef5350]` |  
| Accent (primary actions, DAG pulse) | `#0EA5E9` | `bg-sky-500` |  
| Warning | `#F59E0B` | `text-amber-500` |  
| Forecast band fill | `#0EA5E91A` | `fill-sky-500/10` |  
| Forecast median (dashed) | `#0EA5E9` | `stroke-sky-500` |

### Typography  
| Element | Font | Tailwind |  
|---|---|---|  
| UI text | Inter | `font-sans` |  
| Numbers (prices, latency, tokens) | Inter with tabular-nums | `font-sans tabular-nums` |  
| Code (audit log payloads) | JetBrains Mono | `font-mono` |

## 4. Microinteractions (max 6)  
1. Number flash on update — Framer Motion 250ms ease-out  
2. Skeleton states for charts — shadcn Skeleton bg-neutral-800 animate-pulse  
3. Optimistic UI for watchlist add — TanStack Query onMutate  
4. DAG edge dash-march while node is running — React Flow animated: true  
5. Cursor-following crosshair — lightweight-charts built-in  
6. Toast with undo action — shadcn useToast() + ToastAction

## 5. REJECT WITH REASONING  
| Pattern | Why reject |  
|---|---|  
| Bloomberg-Terminal ultra-dense multi-pane | Density loses on first impression in 4-min video |  
| Custom-drawn D3 candlestick | lightweight-charts does it in 30 LOC |  
| Plotly inside React | Bundle size +500KB; theming fights Tailwind |  
| Glassmorphism / backdrop-filter | Performance cost on Render free-tier |  
| Bespoke icon set | Lucide already ships with shadcn |

## 6. The 3 patterns that move from "good intern" → "product taste"  
1. Pulse animation on active DAG node + animated edge (0.75h)  
2. Cursor-following crosshair with OHLC overlay (1h)  
3. Number flash on update for holdings P&L (0.5h)

## 7. The ONE pattern most candidates skip — but we won't  
**Tabular numerals (Pattern 4).** 0.1h. One class: `tabular-nums`. Pro reviewers notice immediately.

## 8. ui-ux-pro-max usage prompt (Day 2, run once)

```  
> ui-ux-pro-max  
> Generate a design brief for FinSight AI:  
>   - Audience: retail analysts; dark mode default  
>   - Stack already locked: shadcn/ui + Tailwind + Recharts + lightweight-charts + React Flow + Framer Motion  
>   - Surface ladder: neutral-950 → 900 → 800 (DO NOT change)  
>   - Need: 1 accent color, 1 chart palette of 5 colors, 1 heading font pairing  
>   - Constraint: zero new dependencies; output Tailwind classes / hex codes only  
>   - Do NOT generate a full design system — augment the shadcn neutral theme only  
```

Capture output → paste into `frontend/src/styles/tokens.ts` → commit → never tweak again.