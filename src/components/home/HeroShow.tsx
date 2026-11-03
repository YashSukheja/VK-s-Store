import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { DEMO_HERO_PHOTO, HERO_PHOTO_PATH } from '../../data/catalog'
import { imageUrl } from '../../lib/supabase'
import { VrackMark } from '../Logo'

gsap.registerPlugin(ScrollTrigger)
// Phone browser bars hide and show while scrolling; don't recalculate (and jump) when they do.
ScrollTrigger.config({ ignoreMobileResize: true })

const WORD = 'VRACK'
const LINE = 'The new rack is in — Hand-picked — Never basic — '

/**
 * The first screen and its scroll scene. On load the logo rises and the mannequin comes up.
 * Then the screen holds still for one more screen of scrolling: the logo lifts away, the mannequin
 * zooms in, and a giant line of text slides behind it. With reduce motion on, it is a still poster.
 */
export function HeroShow({ pieces, play }: { pieces: number; play: boolean }) {
  const root = useRef<HTMLElement>(null)
  const [src, setSrc] = useState(() => imageUrl(HERO_PHOTO_PATH))
  const [month] = useState(() => new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase())

  useLayoutEffect(() => {
    if (!play || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .from('.hero-mark', { y: 30, opacity: 0, duration: 0.6, ease: 'power3.out' })
        .from('.hero-letter', { yPercent: 105, duration: 0.7, stagger: 0.06, ease: 'power4.out' }, '-=0.4')
        .from('.hero-sub', { opacity: 0, y: 12, duration: 0.4 }, '-=0.4')
        .from('.hero-figure', { y: 80, opacity: 0, duration: 0.9, ease: 'power3.out' }, '-=0.6')
        .from('.hero-corner', { opacity: 0, y: 10, duration: 0.4, stagger: 0.08 }, '-=0.5')

      gsap
        .timeline({
          scrollTrigger: { trigger: root.current, start: 'top top+=64', end: '+=100%', pin: true, scrub: 0.6 },
          defaults: { ease: 'none' },
        })
        .to('.hero-brand', { yPercent: -60, opacity: 0, duration: 0.35 }, 0)
        .to('.hero-top, .hero-note', { opacity: 0, duration: 0.2 }, 0)
        .fromTo('.hero-line', { opacity: 0 }, { opacity: 1, duration: 0.15 }, 0.1)
        .fromTo('.hero-line-text', { xPercent: 0 }, { xPercent: -50, duration: 0.9 }, 0.1)
        .to('.hero-figure', { scale: 1.5, yPercent: 8, duration: 1 }, 0)
    }, root)
    return () => ctx.revert()
  }, [play])

  return (
    <section
      ref={root}
      aria-label="New on the rack"
      className="bg-studio relative h-[calc(100svh-4rem)] min-h-[560px] overflow-hidden"
    >
      <div className="hero-top relative z-[2] mx-auto flex max-w-6xl justify-between px-5 pt-4 font-display text-[12px] font-extrabold uppercase leading-[1.1] md:pt-6 md:text-sm">
        <span className="hero-corner">
          New on
          <br />
          the rack
        </span>
        <span className="hero-corner text-right">
          {pieces > 0 ? `${pieces} ${pieces === 1 ? 'piece' : 'pieces'}` : 'Every week'}
          <br />
          {month}
        </span>
      </div>

      {/* The logo, big. */}
      <div className="hero-brand relative z-[2] flex flex-col items-center pt-3 md:pt-1">
        <VrackMark size={52} halo="#e2e2e0" className="hero-mark text-ink md:size-[72px]" />
        <h1 className="m-0 mt-1 flex overflow-hidden font-brand text-[25vw] font-semibold leading-[0.9] tracking-[0.06em] md:text-[200px]">
          <span className="sr-only">Vrack Clothing</span>
          {WORD.split('').map((l, i) => (
            <span key={i} className="hero-letter inline-block" aria-hidden="true">
              {l}
            </span>
          ))}
        </h1>
        <p className="hero-sub m-0 mt-1 font-brand text-[11px] font-semibold tracking-[0.55em] md:text-sm">CLOTHING</p>
      </div>

      {/* A giant line of text that slides behind the mannequin while it zooms. */}
      <div aria-hidden="true" className="hero-line pointer-events-none absolute inset-x-0 top-[44%] z-0 opacity-0">
        <p className="hero-line-text m-0 w-max whitespace-nowrap font-display text-[26vw] font-black uppercase leading-none tracking-[-0.04em] md:text-[220px]">
          {LINE}
          {LINE}
        </p>
      </div>

      {/* Centred by its box, not a CSS translate: GSAP turns translates into fixed pixels, which drift. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[68px] z-[1] flex h-[58%] justify-center md:bottom-[76px] md:h-[56%]">
        <img
          src={src}
          alt="This week's look: sage green shirt with washed black jeans"
          onError={() => setSrc(DEMO_HERO_PHOTO)}
          className="hero-figure h-full w-auto max-w-none origin-[50%_30%] object-contain drop-shadow-[0_30px_24px_rgb(0_0_0/0.18)]"
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[2] mx-auto flex max-w-6xl items-end justify-between gap-3 px-5 pb-4 md:pb-6">
        <span className="hero-corner font-display text-[13px] font-extrabold uppercase leading-[1.1] md:text-sm">
          Never
          <br />
          basic
        </span>
        <span className="hero-corner hero-note max-w-[10rem] text-center text-[11px] leading-snug md:max-w-xs md:text-[13px]">
          Hand-picked men's clothing. Book online, pick up in store.
        </span>
        <Link to="/shop" className="hero-corner flex min-h-11 items-end text-right font-display text-[13px] font-extrabold uppercase leading-[1.1] md:text-sm">
          <span>
            Shop
            <br />
            now →
          </span>
        </Link>
      </div>
    </section>
  )
}
