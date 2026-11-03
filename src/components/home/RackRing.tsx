import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router'
import { discountPercent, formatPrice, sortedImages } from '../../lib/format'
import { imageUrl, thumbUrl } from '../../lib/supabase'
import type { Product } from '../../lib/types'
import { Photo } from '../Photo'

gsap.registerPlugin(ScrollTrigger)

/**
 * "On the rack": the newest pieces hang on a round 3D clothes rack that turns as the page
 * scrolls past, and can be swiped or stepped with the arrows.
 * With reduce motion on, or with fewer than 4 pieces, it is a plain sideways row.
 */
export function RackRing({ products, total }: { products: Product[]; total: number }) {
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const ring = products.length >= 4 && !still

  return (
    <section aria-labelledby="on-rack" className="overflow-hidden bg-[#f4f4f2] pb-6 pt-12 md:pt-16">
      <div className="mx-auto mb-2 flex max-w-6xl items-baseline justify-between px-5">
        <h2 id="on-rack" className="m-0 font-display text-[28px] font-black uppercase leading-none md:text-5xl">
          On the rack
        </h2>
        <Link to="/shop" className="flex min-h-11 items-center text-sm font-bold underline underline-offset-4">
          Shop all {total}
        </Link>
      </div>
      {ring ? <Ring products={products} /> : <Row products={products} />}
    </section>
  )
}

function Row({ products }: { products: Product[] }) {
  return (
    <ul className="no-scrollbar mx-auto mt-2 flex max-w-6xl list-none snap-x gap-3 overflow-x-auto px-5 pb-2 md:gap-5">
      {products.map((p) => (
        <li key={p.id} className="w-[44vw] max-w-60 flex-none snap-start">
          <Card product={p} />
        </li>
      ))}
    </ul>
  )
}

const ROD_SEGMENTS = 40

/**
 * A round clothes rack in 3D: a silver rod ring on a centre pole with spokes, and a black hanger
 * on the rod for each piece, holding its square photo with two clips. The rack turns with the
 * page scroll, a swipe or the arrows, and the hangers swing a little when it moves and settle.
 */
function Ring({ products }: { products: Product[] }) {
  const stage = useRef<HTMLDivElement>(null)
  const spinner = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLLIElement | null)[]>([])
  const swings = useRef<(HTMLDivElement | null)[]>([])
  const rods = useRef<(HTMLSpanElement | null)[]>([])
  const state = useRef({ scroll: 0, drag: { value: 0 }, dragging: false, startX: 0, startDrag: 0, moved: false })
  const [front, setFront] = useState(0)
  const n = products.length
  const step = 360 / n
  const angleNow = () => state.current.scroll + state.current.drag.value

  // Draws the rack for the current angle: turns it, and dims what is turned away.
  const draw = useRef(() => {})
  draw.current = () => {
    const el = spinner.current
    if (!el) return
    const angle = angleNow()
    el.style.transform = `translateZ(calc(var(--r) * -1)) rotateX(-10deg) rotateY(${angle}deg)`
    const facingOf = (deg: number) => Math.cos(((deg + angle) * Math.PI) / 180) // 1 in front, -1 behind
    cards.current.forEach((card, i) => {
      if (!card) return
      const facing = facingOf(i * step)
      card.style.opacity = String(0.22 + 0.78 * Math.max(0, (facing + 0.35) / 1.35))
    })
    rods.current.forEach((rod, k) => {
      if (rod) rod.style.opacity = String(0.6 + 0.4 * Math.max(0, facingOf((k * 360) / ROD_SEGMENTS)))
    })
    const i = ((Math.round(-angle / step) % n) + n) % n
    setFront((f) => (f === i ? f : i))
  }

  useLayoutEffect(() => {
    draw.current()
    const st = ScrollTrigger.create({
      trigger: stage.current,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        state.current.scroll = -self.progress * step * Math.min(n, 4)
        draw.current()
      },
    })
    return () => st.kill()
  }, [n, step])

  // The hangers swing on a soft spring, pushed by how fast the rack turns. Each one is a little
  // different so they don't move in lockstep. Runs only while the rack is on screen.
  useEffect(() => {
    const springs = products.map((_, i) => ({ x: 0, v: 0, k: 0.011 + (i % 3) * 0.0025, f: 0.9 + ((i * 7) % 5) * 0.06 }))
    let last = angleNow()
    const tick = () => {
      const now = angleNow()
      const speed = Math.max(-12, Math.min(12, now - last))
      last = now
      springs.forEach((s, i) => {
        s.v += -s.k * s.x - 0.07 * s.v + speed * 0.09 * s.f
        s.x = Math.max(-16, Math.min(16, s.x + s.v))
        const el = swings.current[i]
        if (el) el.style.transform = `rotate(${s.x.toFixed(2)}deg)`
      })
    }
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        last = angleNow()
        gsap.ticker.add(tick)
      } else gsap.ticker.remove(tick)
    })
    if (stage.current) seen.observe(stage.current)
    const onResize = () => draw.current()
    window.addEventListener('resize', onResize)
    return () => {
      seen.disconnect()
      gsap.ticker.remove(tick)
      window.removeEventListener('resize', onResize)
    }
  }, [products.length])

  function turnTo(value: number) {
    gsap.to(state.current.drag, { value, duration: 0.8, ease: 'power3.out', onUpdate: () => draw.current() })
  }
  function by(cards: number) {
    const s = state.current
    turnTo(Math.round((s.scroll + s.drag.value) / step) * step - s.scroll - cards * step)
  }

  function down(e: ReactPointerEvent) {
    const s = state.current
    gsap.killTweensOf(s.drag)
    Object.assign(s, { dragging: true, startX: e.clientX, startDrag: s.drag.value, moved: false })
  }
  function move(e: ReactPointerEvent) {
    const s = state.current
    if (!s.dragging) return
    const dx = e.clientX - s.startX
    if (Math.abs(dx) > 6) s.moved = true
    s.drag.value = s.startDrag + dx * 0.3
    draw.current()
  }
  function up() {
    const s = state.current
    if (!s.dragging) return
    s.dragging = false
    if (s.moved) by(0) // settle on the nearest piece
  }

  const metal = 'linear-gradient(180deg,#fdfdfd 0%,#c9c9c9 30%,#8d8d8d 55%,#dcdcdc 75%,#7a7a7a 100%)'
  const metalSide = 'linear-gradient(90deg,#7a7a7a 0%,#e9e9e9 35%,#b5b5b5 60%,#6e6e6e 100%)'

  return (
    <div>
      <div
        ref={stage}
        className="relative mx-auto h-[380px] touch-pan-y select-none [--card:140px] [--pole:280px] [--r:172px] [--rod:6px] [perspective:900px] md:h-[500px] md:[--card:210px] md:[--pole:400px] md:[--r:460px] md:[--rod:8px] md:[perspective:1400px]"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        onClickCapture={(e) => {
          // A swipe that ends on a piece shouldn't open it.
          if (state.current.moved) {
            e.preventDefault()
            e.stopPropagation()
            state.current.moved = false
          }
        }}
      >
        <div ref={spinner} className="absolute left-1/2 top-[80px] h-0 w-0 [transform-style:preserve-3d] md:top-[104px]">
          {/* A soft shadow on the floor under the rack. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[calc(var(--r)*-1.05)] top-[calc(var(--pole)-var(--r)*1.05)] size-[calc(var(--r)*2.1)] rounded-full"
            style={{ transform: 'rotateX(90deg)', background: 'radial-gradient(closest-side, rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.06) 70%, transparent)' }}
          />
          {/* The rack hangs from a pole that rises out of view (two crossed planes read as a round tube). */}
          {[0, 90].map((deg) => (
            <span
              key={deg}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-[-4px] h-[110px] w-[8px] [mask-image:linear-gradient(transparent,#000_60%)]"
              style={{ transform: `rotateY(${deg}deg)`, background: metalSide }}
            />
          ))}
          {/* Four spokes from the pole to the rod. */}
          {[45, 135, 225, 315].map((deg) => (
            <span
              key={deg}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-[calc(var(--rod)/-2)] h-[var(--rod)] w-[var(--r)] origin-left"
              style={{ transform: `rotateY(${deg}deg)`, background: metal }}
            />
          ))}
          {/* The silver rod: short curved-looking strips set around the circle. */}
          {Array.from({ length: ROD_SEGMENTS }, (_, k) => (
            <span
              key={k}
              aria-hidden="true"
              ref={(el) => {
                rods.current[k] = el
              }}
              className="pointer-events-none absolute left-[calc(var(--r)*-0.0786-2px)] top-[calc(var(--rod)/-2)] h-[var(--rod)] w-[calc(var(--r)*0.1572+4px)]"
              style={{ transform: `rotateY(${(k * 360) / ROD_SEGMENTS}deg) translateZ(var(--r))`, background: metal }}
            />
          ))}
          <ul className="m-0 list-none p-0 [transform-style:preserve-3d]">
            {products.map((p, i) => (
              <li
                key={p.id}
                ref={(el) => {
                  cards.current[i] = el
                }}
                className="absolute left-[calc(var(--card)/-2)] top-[calc(var(--card)*-0.05)] w-[var(--card)]"
                style={{ transform: `rotateY(${i * step}deg) translateZ(calc(var(--r) + 1px))` }}
                onFocus={() => turnTo(-i * step - state.current.scroll)}
              >
                <div
                  ref={(el) => {
                    swings.current[i] = el
                  }}
                  className="origin-[50%_calc(var(--card)*0.05)] will-change-transform"
                >
                  <HangingCard product={p} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5">
        <p className="m-0 font-display text-sm font-extrabold uppercase" aria-live="polite">
          {String(front + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          <span className="ml-2 font-sans font-semibold normal-case text-muted">{products[front]?.name}</span>
        </p>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous look" onClick={() => by(-1)} className="flex size-11 items-center justify-center border-[1.5px] border-ink text-lg font-bold">
            ←
          </button>
          <button type="button" aria-label="Next look" onClick={() => by(1)} className="flex size-11 items-center justify-center bg-ink text-lg font-bold text-white">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

/** A black clip hanger with a silver hook, and the square photo held by its two clips. */
function HangingCard({ product: p }: { product: Product }) {
  const img = sortedImages(p)[0]
  const off = discountPercent(p.price, p.mrp)
  return (
    <Link to={`/p/${p.id}`} draggable={false} className="relative block pt-[calc(var(--card)*0.36)]">
      <svg viewBox="0 0 100 42" aria-hidden="true" className="absolute inset-x-0 top-0 z-[1] w-full overflow-visible">
        <defs>
          <linearGradient id="hook-metal" x1="0" x2="1">
            <stop offset="0" stopColor="#6f6f6f" />
            <stop offset="0.45" stopColor="#f2f2f2" />
            <stop offset="1" stopColor="#8a8a8a" />
          </linearGradient>
          <linearGradient id="clip-metal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#e6e6e6" />
            <stop offset="1" stopColor="#8f8f8f" />
          </linearGradient>
        </defs>
        {/* hook over the rod */}
        <path d="M50 21 C50 15 46 13 46 8 A4.2 4.2 0 1 1 54.4 8 L54.2 10" fill="none" stroke="url(#hook-metal)" strokeWidth="1.6" strokeLinecap="round" />
        {/* shoulders and bar */}
        <path d="M50 20.5 L7 32 Q3.5 33.2 6 34.6 L94 34.6 Q96.5 33.2 93 32 Z" fill="none" stroke="#141414" strokeWidth="2.6" strokeLinejoin="round" />
        <rect x="47.6" y="18.6" width="4.8" height="4" rx="1.4" fill="#141414" />
        {/* clips */}
        {[20, 80].map((x) => (
          <g key={x}>
            <rect x={x - 3.6} y="33.2" width="7.2" height="7.6" rx="0.8" fill="url(#clip-metal)" stroke="#5c5c5c" strokeWidth="0.5" />
            <line x1={x - 2} x2={x + 2} y1="35.4" y2="35.4" stroke="#6a6a6a" strokeWidth="0.6" />
          </g>
        ))}
      </svg>
      <span className="relative block aspect-square overflow-hidden bg-photo shadow-[0_22px_34px_-20px_rgb(0_0_0/0.5)]">
        <Photo src={thumbUrl(img.path)} fallbackSrc={imageUrl(img.path)} alt={p.name} className="pointer-events-none" />
        {off !== null && <span className="absolute bottom-2 left-2 bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-white">{off}% OFF</span>}
      </span>
      <span className="mt-1.5 flex items-baseline justify-between gap-2 bg-white px-2 py-1.5">
        <span className="truncate text-[12px] font-semibold md:text-[13px]">{p.name}</span>
        <span className="flex-none font-display text-[13px] font-black md:text-sm">{formatPrice(p.price)}</span>
      </span>
    </Link>
  )
}

function Card({ product: p, big = false }: { product: Product; big?: boolean }) {
  const img = sortedImages(p)[0]
  const off = discountPercent(p.price, p.mrp)
  return (
    <Link to={`/p/${p.id}`} draggable={false} className="group block bg-white shadow-[0_24px_40px_-24px_rgb(0_0_0/0.45)]">
      <span className="relative block aspect-[3/4] overflow-hidden bg-photo">
        <Photo src={thumbUrl(img.path)} fallbackSrc={imageUrl(img.path)} alt={p.name} className="pointer-events-none transition-transform duration-500 group-hover:scale-105" />
        {off !== null && <span className="absolute left-2 top-2 bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-white">{off}% OFF</span>}
      </span>
      <span className={`flex items-baseline justify-between gap-2 px-2.5 ${big ? 'py-2.5' : 'py-2'}`}>
        <span className="truncate text-[13px] font-semibold">{p.name}</span>
        <span className="flex-none font-display text-sm font-black">{formatPrice(p.price)}</span>
      </span>
    </Link>
  )
}
