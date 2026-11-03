import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

gsap.registerPlugin(ScrollTrigger)

const TEXT = [
  { title: 'Pick', text: 'Browse the rack and choose your size. Every piece is checked by hand.' },
  { title: 'Book', text: 'Book it online in a minute. Nothing to pay yet.' },
  { title: 'Pick up', text: 'Collect it from the store within 48 hours. We keep it aside for you.' },
  { title: 'Pay', text: 'See it in your hands, then pay cash or UPI.' },
]

// A winding ribbon with loops, one layout for phones (tall) and one for wide screens.
const LAYOUTS = {
  phone: {
    w: 400,
    h: 1100,
    d: 'M-30 60 C40 40 80 100 70 180 C60 260 110 330 190 350 C270 370 300 290 250 260 C200 230 160 310 220 380 C260 420 330 400 330 470 C330 560 250 590 180 610 C100 630 60 660 70 740 C80 820 150 850 220 860 C300 870 250 790 200 820 C150 850 210 930 330 990 C380 1015 400 1060 430 1090',
    // How far along the ribbon each stop sits (0 to 1), measured once ahead of time:
    // measuring a long path in the browser is slow on phones.
    marks: [0.093, 0.444, 0.646, 0.93],
    nodes: [
      { x: 70, y: 180, side: 'right' },
      { x: 330, y: 470, side: 'left' },
      { x: 70, y: 740, side: 'right' },
      { x: 330, y: 990, side: 'left' },
    ],
  },
  wide: {
    w: 1000,
    h: 700,
    d: 'M-30 120 C60 100 110 130 130 200 C150 280 200 330 280 330 C360 330 360 250 310 250 C250 250 260 360 330 420 C380 460 420 470 430 520 C440 580 520 600 560 520 C600 440 600 300 650 220 C690 160 760 170 760 230 C760 290 690 290 700 240 C720 170 820 250 850 330 C880 420 880 500 900 540 C920 590 980 620 1040 640',
    marks: [0.089, 0.399, 0.615, 0.922],
    nodes: [
      { x: 130, y: 200, side: 'right' },
      { x: 430, y: 520, side: 'right' },
      { x: 650, y: 220, side: 'left' },
      { x: 900, y: 540, side: 'left' },
    ],
  },
} as const

/**
 * "How it works": a thick black ribbon draws itself along a winding, looping path as you scroll.
 * Each numbered stop fills in and its words rise when the ribbon reaches it.
 */
export function HowItWorks() {
  const root = useRef<HTMLElement>(null)
  const ribbon = useRef<SVGPathElement>(null)
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [reached, setReached] = useState(TEXT.length)
  const layout = LAYOUTS[wide ? 'wide' : 'phone']

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useLayoutEffect(() => {
    const path = ribbon.current
    if (!path || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const total = path.getTotalLength()
    path.style.strokeDasharray = `${total}`
    path.style.strokeDashoffset = `${total}`
    setReached(0)
    const st = ScrollTrigger.create({
      trigger: path.parentElement,
      start: 'top 70%',
      end: 'bottom 60%',
      scrub: 0.5,
      onUpdate: (self) => {
        path.style.strokeDashoffset = `${total * (1 - self.progress)}`
        const count = layout.marks.filter((m) => self.progress >= m).length
        setReached((r) => (r === count ? r : count))
      },
    })
    return () => {
      st.kill()
      path.style.strokeDasharray = ''
      path.style.strokeDashoffset = ''
    }
  }, [layout])

  return (
    <section ref={root} aria-labelledby="how" className="mx-auto max-w-6xl overflow-hidden px-5 pt-16 md:pt-24">
      <h2 id="how" className="m-0 font-display text-[28px] font-black uppercase leading-none md:text-5xl">
        Four steps,
        <br />
        then it's yours
      </h2>
      <div className="relative mt-6" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
        <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <path d={layout.d} fill="none" stroke="#e1e1dd" strokeWidth={22} strokeLinecap="round" />
          <path key={layout.d} ref={ribbon} d={layout.d} fill="none" stroke="#0b0b0b" strokeWidth={22} strokeLinecap="round" />
        </svg>
        <ol className="m-0 list-none p-0">
          {layout.nodes.map((n, i) => {
            const on = i < reached
            const right = n.side === 'right'
            return (
              <li
                key={i}
                className="absolute"
                style={{ left: `${(n.x / layout.w) * 100}%`, top: `${(n.y / layout.h) * 100}%` }}
              >
                <span
                  className={`absolute left-0 top-0 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-display text-sm font-black ring-4 ring-white transition-all duration-300 md:size-14 md:text-base ${on ? 'scale-100 bg-ink text-white' : 'scale-90 bg-[#c9c9c4] text-white'}`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`absolute top-0 z-[1] block w-[52vw] max-w-72 -translate-y-1/2 bg-white/90 p-1.5 transition-all duration-500 md:w-64 ${right ? 'left-8 md:left-11' : 'right-8 text-right md:right-11'} ${on ? 'mt-0 opacity-100' : 'mt-4 opacity-0'}`}
                >
                  <span className="block font-display text-2xl font-black uppercase leading-none md:text-4xl">{TEXT[i].title}</span>
                  <span className="mt-1.5 block text-sm leading-snug text-body md:text-base">{TEXT[i].text}</span>
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
