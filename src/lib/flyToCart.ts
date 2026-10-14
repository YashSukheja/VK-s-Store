/**
 * Flies a small copy of the product photo into the cart icon.
 * Does nothing when the phone asks for reduced motion.
 */
export function flyToCart(from: Element | null) {
  if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const target = [...document.querySelectorAll('[data-cart-target]')].find((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
  })
  if (!target) return

  const a = from.getBoundingClientRect()
  const b = target.getBoundingClientRect()
  const size = Math.min(a.width, a.height, 160)
  const img = from.querySelector('img')

  const ghost = document.createElement('div')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${a.left + a.width / 2 - size / 2}px`,
    top: `${a.top + a.height / 2 - size / 2}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '16px',
    background: img ? `center / cover no-repeat url("${img.currentSrc || img.src}")` : '#d4ff3f',
    boxShadow: '0 10px 30px rgb(0 0 0 / 0.25)',
    zIndex: '60',
    pointerEvents: 'none',
  })
  document.body.appendChild(ghost)

  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  ghost
    .animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1, borderRadius: '16px' },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 60}px) scale(0.45)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.1)`, opacity: 0.4, borderRadius: '50%' },
      ],
      { duration: 650, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
    )
    .finished.finally(() => ghost.remove())
}
