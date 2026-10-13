import { useState, type FormEvent } from 'react'
import { Card, fieldClass, Notice, Toggle } from '../../components/admin'
import { DownIcon, UpIcon } from '../../components/Icons'
import { ErrorBox, Loading } from '../../components/States'
import { fetchCategories } from '../../data/catalog'
import { slugify } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Category } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

function parseSizes(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && s.length <= 10 && !seen.has(s) && seen.add(s))
}

export function AdminCategories() {
  const { data, error, loading, reload } = useAsync(fetchCategories, [])
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [newName, setNewName] = useState('')
  const [newSizes, setNewSizes] = useState('S, M, L, XL, XXL')

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const categories = data ?? []

  async function run(action: PromiseLike<{ error: { message: string; code?: string } | null }>, ok: string) {
    setMessage(null)
    const { error: err } = await action
    if (err) {
      const text =
        err.code === '23503'
          ? 'This category still has products. Move or delete them first, or just hide the category.'
          : err.code === '23505'
            ? 'A category with that name already exists.'
            : err.message
      setMessage({ kind: 'error', text })
      return false
    }
    setMessage({ kind: 'ok', text: ok })
    reload()
    return true
  }

  async function add(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const done = await run(
      supabase.from('categories').insert({
        name,
        slug: slugify(name) || `category-${Date.now()}`,
        sizes: parseSizes(newSizes),
        sort_order: (categories.at(-1)?.sort_order ?? 0) + 1,
      }),
      `Added ${name}.`,
    )
    if (done) setNewName('')
  }

  async function move(index: number, by: -1 | 1) {
    const target = index + by
    if (target < 0 || target >= categories.length) return
    const order = [...categories]
    ;[order[index], order[target]] = [order[target], order[index]]
    // Renumber every category so positions stay distinct.
    await run(
      Promise.all(order.map((c, i) => supabase.from('categories').update({ sort_order: i }).eq('id', c.id))).then((results) => ({
        error: results.find((r) => r.error)?.error ?? null,
      })),
      'Order saved.',
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="m-0 font-display text-2xl font-black uppercase">Categories</h1>
      <p className="m-0 text-sm text-body">Each category has a size list. New products in it start with these sizes.</p>
      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      {categories.map((c, i) => (
        <CategoryRow
          key={`${c.id}-${c.sort_order}-${c.name}-${c.sizes.join()}-${c.is_visible}`}
          category={c}
          first={i === 0}
          last={i === categories.length - 1}
          onMove={(by) => void move(i, by)}
          onSave={(patch) => run(supabase.from('categories').update(patch).eq('id', c.id), `Saved ${patch.name ?? c.name}.`)}
          onDelete={() => {
            if (window.confirm(`Delete the category “${c.name}”?`)) void run(supabase.from('categories').delete().eq('id', c.id), `Deleted ${c.name}.`)
          }}
        />
      ))}

      <form onSubmit={add}>
        <Card title="New category">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Name
            <input className={fieldClass} maxLength={40} placeholder="e.g. Jackets" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Sizes, separated by commas
            <input className={fieldClass} value={newSizes} onChange={(e) => setNewSizes(e.target.value)} />
          </label>
          <button disabled={!newName.trim()} className="h-11 rounded-xl bg-ink text-sm font-extrabold text-white disabled:opacity-50">
            Add category
          </button>
        </Card>
      </form>
    </div>
  )
}

function CategoryRow({
  category,
  first,
  last,
  onMove,
  onSave,
  onDelete,
}: {
  category: Category
  first: boolean
  last: boolean
  onMove: (by: -1 | 1) => void
  onSave: (patch: Partial<Category>) => Promise<boolean>
  onDelete: () => void
}) {
  const [name, setName] = useState(category.name)
  const [sizes, setSizes] = useState(category.sizes.join(', '))
  const [visible, setVisible] = useState(category.is_visible)
  const dirty = name.trim() !== category.name || parseSizes(sizes).join() !== category.sizes.join() || visible !== category.is_visible

  return (
    <Card>
      <div className="flex items-center gap-2">
        <input aria-label="Category name" className={`${fieldClass} font-bold`} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" aria-label={`Move ${category.name} up`} disabled={first} onClick={() => onMove(-1)} className="flex size-11 flex-none items-center justify-center rounded-xl border-[1.5px] border-field disabled:opacity-30">
          <UpIcon size={18} />
        </button>
        <button type="button" aria-label={`Move ${category.name} down`} disabled={last} onClick={() => onMove(1)} className="flex size-11 flex-none items-center justify-center rounded-xl border-[1.5px] border-field disabled:opacity-30">
          <DownIcon size={18} />
        </button>
      </div>
      <label className="flex flex-col gap-1.5 text-xs font-bold text-muted">
        Sizes
        <input className={fieldClass} value={sizes} onChange={(e) => setSizes(e.target.value)} />
      </label>
      <Toggle label="Show in shop" checked={visible} onChange={setVisible} />
      <div className="flex items-center justify-between">
        <button type="button" onClick={onDelete} className="min-h-11 text-sm font-bold text-danger underline underline-offset-4">
          Delete
        </button>
        <button
          type="button"
          disabled={!dirty || !name.trim()}
          onClick={() => void onSave({ name: name.trim(), sizes: parseSizes(sizes), is_visible: visible })}
          className="h-11 rounded-xl bg-ink px-5 text-sm font-extrabold text-white disabled:opacity-30"
        >
          Save
        </button>
      </div>
    </Card>
  )
}
