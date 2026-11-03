import gsap from 'gsap'
import { useLayoutEffect, useRef } from 'react'

const WORD = 'VRACK'

/**
 * The black opening screen: the V-hanger mark draws itself, VRACK rises letter by letter,
 * then the panel lifts away to show the page. Plays each time the home page opens; Skip ends it at once.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    const html = document.documentElement
    html.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    const ctx = gsap.context(() => {
      timeline.current = gsap
        .timeline({
          onComplete: () => {
            html.style.overflow = ''
            onDone()
          },
        })
        .from('.intro-v', { yPercent: 60, opacity: 0, duration: 0.55, ease: 'power3.out' })
        .fromTo('.intro-hanger', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, '-=0.15')
        .from('.intro-letter', { yPercent: 110, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, '-=0.35')
        .from('.intro-sub', { opacity: 0, y: 10, duration: 0.35 }, '-=0.2')
        .to(root.current, { yPercent: -100, duration: 0.75, ease: 'power4.inOut', delay: 0.3 })
    }, root)
    return () => {
      ctx.revert()
      html.style.overflow = ''
    }
  }, [onDone])

  return (
    <div ref={root} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink text-white" role="presentation">
      <svg viewBox="0 0 100 100" className="intro-v size-24 md:size-32" aria-hidden="true">
        <path d="M14 20 L34 20 L50 76 L66 20 L86 20 L56 98 L44 98 Z" fill="currentColor" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 36 V27 A7 7 0 1 0 43 20 M50 36 L12 60 L88 60 Z" stroke="#000" strokeWidth={10} />
          <path className="intro-hanger" pathLength={1} strokeDasharray="1" d="M50 36 V27 A7 7 0 1 0 43 20 M50 36 L12 60 L88 60 Z" stroke="currentColor" strokeWidth={4.5} />
        </g>
      </svg>
      <p className="m-0 mt-5 flex overflow-hidden font-brand text-[44px] font-semibold leading-none tracking-[0.14em] md:text-7xl" aria-label="Vrack">
        {WORD.split('').map((l, i) => (
          <span key={i} className="intro-letter inline-block" aria-hidden="true">
            {l}
          </span>
        ))}
      </p>
      <p className="intro-sub m-0 mt-3 font-brand text-xs font-semibold tracking-[0.5em] text-[#bdbdb8] md:text-sm">CLOTHING</p>
      <button
        type="button"
        onClick={() => timeline.current?.progress(1)}
        className="absolute bottom-6 right-5 flex min-h-11 items-center px-3 text-sm font-bold text-[#bdbdb8] underline underline-offset-4"
      >
        Skip
      </button>
    </div>
  )
}
