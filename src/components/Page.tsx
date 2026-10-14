import type { ReactNode } from 'react'
import { useAsync } from '../lib/useAsync'
import { fetchSettings } from '../data/catalog'
import { SiteHeader } from './SiteHeader'

/** Shop header plus a narrow column, for cart, login and booking pages. */
export function Page({ title, children }: { title: string; children: ReactNode }) {
  const settings = useAsync(fetchSettings, [])
  return (
    <div className="min-h-dvh bg-white">
      <SiteHeader settings={settings.data} />
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 pb-16 pt-6">
        <h1 className="m-0 font-display text-[28px] font-black uppercase leading-none">{title}</h1>
        {children}
      </main>
    </div>
  )
}
