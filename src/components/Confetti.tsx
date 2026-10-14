import { useEffect, useRef } from 'react'

const COLORS = ['#d4ff3f', '#111111', '#ffffff', '#d4ff3f']

/** A short burst of lime, black and white confetti. Skipped for reduced motion. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dpr = window.devicePixelRatio || 1
    const w = (canvas.width = window.innerWidth * dpr)
    const h = (canvas.height = window.innerHeight * dpr)
    const pieces = Array.from({ length: 90 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.3,
      vx: (Math.random() - 0.5) * 16 * dpr,
      vy: (-Math.random() * 14 - 6) * dpr,
      size: (Math.random() * 6 + 5) * dpr,
      spin: Math.random() * Math.PI,
      vs: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }))
    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, w, h)
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1400) / 600)
      for (const p of pieces) {
        p.vy += 0.45 * dpr
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.spin += p.vs
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.fillStyle = p.color
        ctx.strokeStyle = '#111111'
        ctx.lineWidth = dpr
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        if (p.color === '#ffffff') ctx.strokeRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (t < 2000) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, w, h)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 h-full w-full" />
}
