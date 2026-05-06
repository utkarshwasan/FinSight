import { Clock } from "lucide-react"
import { useEffect, useState } from "react"

type Exchange = {
  name: string
  tz: string          // IANA timezone
  openMin: number     // minutes from midnight local
  closeMin: number    // minutes from midnight local
  weekendClosed: boolean
  shortTz: string     // display abbreviation
}

const EXCHANGES: Exchange[] = [
  { name: "NYSE",   tz: "America/New_York", openMin:  9 * 60 + 30, closeMin: 16 * 60,      weekendClosed: true, shortTz: "ET"  },
  { name: "NASDAQ", tz: "America/New_York", openMin:  9 * 60 + 30, closeMin: 16 * 60,      weekendClosed: true, shortTz: "ET"  },
  { name: "LSE",    tz: "Europe/London",    openMin:  8 * 60,      closeMin: 16 * 60 + 30, weekendClosed: true, shortTz: "GMT" },
  { name: "NSE",    tz: "Asia/Kolkata",     openMin:  9 * 60 + 15, closeMin: 15 * 60 + 30, weekendClosed: true, shortTz: "IST" },
]

function partsFor(tz: string, now: Date): { hh: string; mm: string; weekday: number; minutesOfDay: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const hh = get("hour")
  const mm = get("minute")
  const wd = get("weekday")
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const weekday = weekdayMap[wd] ?? 1
  const h = parseInt(hh, 10)
  const m = parseInt(mm, 10)
  return { hh, mm, weekday, minutesOfDay: h * 60 + m }
}

function statusFor(ex: Exchange, now: Date): { open: boolean; timeStr: string } {
  const { hh, mm, weekday, minutesOfDay } = partsFor(ex.tz, now)
  const isWeekend = weekday === 0 || weekday === 6
  const open =
    !(ex.weekendClosed && isWeekend) &&
    minutesOfDay >= ex.openMin &&
    minutesOfDay < ex.closeMin
  return { open, timeStr: `${hh}:${mm} ${ex.shortTz}` }
}

export function MarketHours() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000) // tick every 30s
    return () => clearInterval(t)
  }, [])

  return (
    <div className="bg-[#121821] rounded-2xl border border-[#232c3a] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-slate-500" />
        <h3 className="text-sm font-semibold tracking-tight">Market Hours</h3>
      </div>
      <div className="space-y-2.5">
        {EXCHANGES.map((ex) => {
          const { open, timeStr } = statusFor(ex, now)
          return (
            <div key={ex.name} className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-bull" : "bg-slate-600"}`} />
                <span className="font-medium">{ex.name}</span>
              </div>
              <div className="flex items-center gap-2 tabular-nums text-slate-500">
                <span className={open ? "text-bull" : "text-slate-500"}>{open ? "Open" : "Closed"}</span>
                <span className="text-slate-700">·</span>
                <span>{timeStr}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
