import { useWsStore } from "@/store/wsStore"

export function AlertToast() {
  const alerts = useWsStore((s) => s.alerts)
  const last = alerts[alerts.length - 1]
  if (!last) return null
  return (
    <div className="fixed top-4 right-4 bg-red-500 text-white p-4 rounded z-50">
      <strong>Alert:</strong> {last.message} for {last.symbol} at ${last.price}
    </div>
  )
}