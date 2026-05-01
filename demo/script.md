# Demo Video Script — FinSight AI (4 minutes)

**Target:** 4:00 (hard cap 5:00) | **Tool:** Loom or OBS | **Pre-flight:** run /demo-check, pre-warm /healthz 30s before, DEMO_MODE=1

## The structure

| Block | Time | Purpose |  
|---|---|---|  
| Cold open (NO talking head) | 0:00–0:15 | Show product working before saying who you are |  
| Self-intro over live screen | 0:15–0:30 | 10 seconds of credibility |  
| The wow shot — NL query → DAG fires | 0:30–1:00 | The reason to keep watching |  
| Watchlist + live ticks + Holdings P&L | 1:00–1:30 | Real-time + portfolio (PDF mandatory rows) |  
| News + sentiment + "Explain this candle" | 1:30–2:00 | Shows agents are interactive |  
| Architecture diagram (PiP) | 2:00–2:30 | Tech proficiency moment |  
| Trade-off explanation (one ADR, on camera) | 2:30–3:00 | Communication + structured thinking |  
| Audit log + alert toast | 3:00–3:30 | Production rigor + compliance feel |  
| Closing — three differentiators + ask | 3:30–4:00 | Make them remember THIS submission |

## Shot-by-shot

**0:00–0:15 (cold open):**  
Screen: dashboard loaded. AAPL chart streaming. 5 React Flow nodes pulse softly.  
VO: "In the next four minutes, you'll watch five AI agents reason about a stock — live."

**0:15–0:30 (self-intro):**  
VO: "I'm Utkarsh Wasan. I shipped Gemini 2.0 Flash multimodal in production on VoxRay AI, and a DAG executor with topological sort in my Visual Workflow Orchestrator project. FinSight combines both."

**0:30–1:00 (THE WOW SHOT):**  
Action: type "Should I worry about TSLA today?" → press Enter. 5 nodes fire in sequence.  
VO: "Five agents. MarketData fetches; News and Forecast run in parallel via asyncio.gather; Risk combines them; Alert decides if any threshold tripped. Topological sort guarantees Forecaster waits for Fetcher. Same executor pattern I built for the Visual Workflow Orchestrator."  
Answer renders with citation chips: "TSLA dropped 4.2% [3] after a downgrade [1]; sentiment is mixed [2][4]."

**1:00–1:30 (watchlist + Holdings P&L):**  
Action: add NVDA to watchlist. Add Position NVDA 10 @ $920. Holdings card appears showing live P&L.  
VO: "Watchlist is real-time over WebSockets — same pattern I shipped on Nexus.ai. Positions track live P&L; the dashboard re-renders on every quote tick, no polling."

**1:30–2:00 (news + sentiment + Explain this candle):**  
Action: click NVDA. Headlines appear with sentiment chips. Click a red candle.  
Action: DAG visualizer fires AGAIN, scoped to that timestamp.  
VO: "Click any candle and the agents re-fire scoped to that moment. The same pipeline; different temporal slice."

**2:00–2:30 (architecture overlay):**  
Screen: Mermaid architecture diagram from README. Webcam in corner.  
VO: "Stack: FastAPI, Postgres with TimescaleDB, hand-rolled DAG executor in 80 lines of asyncio. Frontend: React + Vite, React Flow, lightweight-charts, TanStack Query. Gemini 2.0 Flash for analysis; Prophet for the 7-day forecast."

**2:30–3:00 (trade-off moment — ADR-0001):**  
Screen: open ADR-0001 in VS Code, scroll to Decision section.  
VO: "I considered LangGraph for the agent layer and rejected it. For five nodes, a hand-rolled topological executor is 80 lines, fully observable, and lets me stream partial outputs to the UI. LangGraph would have been faster to start and slower to demo. Same call I made on VoxRay: pick the primitive you can instrument."

**3:00–3:30 (audit log + alert toast):**  
Action: trigger NVDA threshold alert. Toast slides in bottom-right. Click into /audit.  
VO: "Every AI call is logged — model, tokens, latency, cost in INR. Append-only, plain SQL, hand-grepable. Same audit pattern I built for FERPA/GDPR compliance on EduLearn."

**3:30–4:00 (closing):**  
Screen: zoom out to dashboard with DAG visible. Webcam centered.  
VO: "Three things make this different. One: it's a DAG, not a chatbot — agents have dependencies and run in parallel, and you can watch them. Two: every numeric claim is auditable, citation-enforced, and tracked in INR. Three: I disclosed a security bug in an AI orchestration framework last year, so the prompt-injection defenses aren't an afterthought — they're the first thing I wrote. I'd love to bring this mindset to your team."

## Recording checklist  
- [ ] DEMO_MODE=1 on Render  
- [ ] /demo-check 10 steps pass  
- [ ] /healthz curled 30s before recording  
- [ ] Browser zoom 100%, no notifications  
- [ ] Mic level checked  
- [ ] OBS/Loom at 30 fps, 1080p  
- [ ] Practiced script aloud at least twice