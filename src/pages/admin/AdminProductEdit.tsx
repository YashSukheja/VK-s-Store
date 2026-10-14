import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Card, fieldClass, Notice, PrimaryButton, Stepper, Toggle } from '../../components/admin'
import { ArrowLeftIcon, ArrowRightIcon, BackIcon, CloseIcon, PlusIcon } from '../../components/Icons'
import { ErrorBox, Loading } from '../../components/States'
import { fetchCategories, fetchProduct } from '../../data/catalog'
import { sortedImages, sortedSizes } from '../../lib/format'
import { compressPhoto, makeThumbnail, thumbPath } from '../../lib/images'
import { IMAGE_BUCKET, imageUrl, supabase } from '../../lib/supabase'
import type { Category, Product } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'

const MAX_PHOTOS = 8

type Photo =
  | { kind: 'saved'; key: string; id: string; path: string; url: string }
  | { kind: 'new'; key: string; file: File; thumb: File; url: string }

type SizeRow = { size: string; stock: number }

export function AdminProductEdit() {
  const { id } = useParams()
  const location = useLocation()
  const isNew = !id || id === 'new'
  // location.key changes after each save, which reloads the saved product.
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([fetchCategories(), isNew ? Promise.resolve(null) : fetchProduct(id)]),
    [id, location.key],
  )

  if (loading) return <Loading />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  const [categories, product] = data ?? [[], null]
  if (!isNew && !product) return <ErrorBox message="This product was not found. It may have been deleted." />
  if (categories.length === 0) return <ErrorBox message="Add a category first, under Categories." />

  const justSaved = Boolean((location.state as { saved?: boolean } | null)?.saved)
  return <Editor key={`${id ?? 'new'}-${location.key}`} categories={categories} product={product} justSaved={justSaved} />
}

function sizesFor(category: Category | undefined, current: SizeRow[]): SizeRow[] {
  if (!category) return current
  return category.sizes.map((size) => ({ size, stock: current.find((s) => s.size === size)?.stock ?? 0 }))
}

function Editor({ categories, product, justSaved }: { categories: Category[]; product: Product | null; justSaved: boolean }) {
  const navigate = useNavigate()
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0].id)
  const [description, setDescription] = useState(product?.description ?? '')
  const [mrp, setMrp] = useState(product?.mrp ? String(product.mrp) : '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [visible, setVisible] = useState(product?.is_visible ?? true)
  const [onSale, setOnSale] = useState(product?.on_sale ?? false)
  const [sizes, setSizes] = useState<SizeRow[]>(() => {
    if (product) {
      const saved = sortedSizes(product).map((s) => ({ size: s.size, stock: s.stock }))
      // Show the category's full size list, keeping saved stock; keep any extra saved sizes too.
      const preset = sizesFor(categories.find((c) => c.id === product.category_id), saved)
      return [...preset, ...saved.filter((s) => !preset.some((p) => p.size === s.size))]
    }
    return sizesFor(categories[0], [])
  })
  const [photos, setPhotos] = useState<Photo[]>(() =>
    product ? sortedImages(product).map((img) => ({ kind: 'saved', key: img.id, id: img.id, path: img.path, url: imageUrl(img.path) })) : [],
  )
  const [removed, setRemoved] = useState<{ id: string; path: string }[]>([])
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  // Free the browser memory used by previews of unsaved photos.
  useEffect(() => () => photos.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const total = sizes.reduce((sum, s) => sum + s.stock, 0)

  function changeCategory(nextId: string) {
    setCategoryId(nextId)
    setSizes((current) => sizesFor(categories.find((c) => c.id === nextId), current))
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files).slice(0, Math.max(room, 0))
    if (picked.length === 0) return setMessage({ kind: 'error', text: `Up to ${MAX_PHOTOS} photos per product.` })
    setPreparing(true)
    setMessage(null)
    try {
      const ready = await Promise.all(
        picked.map(async (original) => {
          const file = await compressPhoto(original)
          return { file, thumb: await makeThumbnail(file) }
        }),
      )
      setPhotos((current) => [
        ...current,
        ...ready.map(({ file, thumb }) => ({ kind: 'new' as const, key: crypto.randomUUID(), file, thumb, url: URL.createObjectURL(file) })),
      ])
    } catch {
      setMessage({ kind: 'error', text: 'One of those photos could not be read. Try a JPG or PNG.' })
    } finally {
      setPreparing(false)
    }
  }

  function movePhoto(index: number, by: -1 | 1) {
    setPhotos((current) => {
      const next = [...current]
      const target = index + by
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function removePhoto(index: number) {
    const photo = photos[index]
    if (photo.kind === 'saved') setRemoved((r) => [...r, { id: photo.id, path: photo.path }])
    else URL.revokeObjectURL(photo.url)
    setPhotos((current) => current.filter((_, i) => i !== index))
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const priceNum = Number(price)
    const mrpNum = mrp.trim() ? Number(mrp) : null
    if (!name.trim()) return setMessage({ kind: 'error', text: 'Give the product a name.' })
    if (!Number.isInteger(priceNum) || priceNum <= 0) return setMessage({ kind: 'error', text: 'Selling price must be a whole number of rupees.' })
    if (mrpNum !== null && (!Number.isInteger(mrpNum) || mrpNum < priceNum))
      return setMessage({ kind: 'error', text: 'MRP must be a whole number, equal to or above the selling price. Leave it empty if unknown.' })

    setSaving(true)
    try {
      const { data: savedId, error: saveError } = await supabase.rpc('admin_save_product', {
        p_id: product?.id ?? null,
        p_category_id: categoryId,
        p_name: name,
        p_description: description.trim(),
        p_mrp: mrpNum,
        p_price: priceNum,
        p_is_visible: visible,
        p_sizes: sizes,
      })
      if (saveError) throw new Error(saveError.message)
      const productId = savedId as string

      if (onSale !== (product?.on_sale ?? false)) {
        const { error: saleError } = await supabase.from('products').update({ on_sale: onSale }).eq('id', productId)
        if (saleError) throw new Error(saleError.message.includes('on_sale') ? 'The SALE tag needs setup file 5. Run it in Supabase first.' : saleError.message)
      }

      if (removed.length) {
        await supabase.storage.from(IMAGE_BUCKET).remove(removed.flatMap((r) => [r.path, thumbPath(r.path)]))
        const { error: delError } = await supabase.from('product_images').delete().in('id', removed.map((r) => r.id))
        if (delError) throw new Error(delError.message)
      }

      for (const [index, photo] of photos.entries()) {
        if (photo.kind === 'saved') {
          const { error: orderError } = await supabase.from('product_images').update({ sort_order: index }).eq('id', photo.id)
          if (orderError) throw new Error(orderError.message)
          continue
        }
        const path = `${productId}/${crypto.randomUUID()}.webp`
        const { error: upError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, photo.file, { contentType: 'image/webp' })
        if (upError) throw new Error(`Photo upload failed: ${upError.message}`)
        // The small copy is a nice-to-have: the shop falls back to the big photo without it.
        await supabase.storage.from(IMAGE_BUCKET).upload(thumbPath(path), photo.thumb, { contentType: 'image/webp' })
        const { error: rowError } = await supabase.from('product_images').insert({ product_id: productId, path, sort_order: index })
        if (rowError) throw new Error(rowError.message)
      }

      navigate(`/admin/products/${productId}`, { replace: true, state: { saved: true } })
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save. Try again.' })
      setSaving(false)
    }
  }

  async function deleteProduct() {
    if (!product) return
    if (!window.confirm(`Delete “${product.name}”? This removes it and its photos for good. To only hide it, switch off “Show in shop”.`)) return
    setSaving(true)
    const paths = product.product_images.flatMap((i) => [i.path, thumbPath(i.path)])
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    const { error: delError } = await supabase.from('products').delete().eq('id', product.id)
    if (delError) {
      setSaving(false)
      return setMessage({ kind: 'error', text: delError.message })
    }
    navigate('/admin/products', { replace: true })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 pb-6">
      <div className="flex items-center gap-1">
        <Link to="/admin/products" aria-label="Back to products" className="flex size-11 items-center justify-center">
          <BackIcon />
        </Link>
        <h1 className="m-0 font-display text-2xl font-black uppercase">{product ? 'Edit product' : 'Add product'}</h1>
      </div>

      {justSaved && !message && <Notice kind="ok">{visible ? 'Saved. It’s live in the shop.' : 'Saved. It’s hidden from the shop.'}</Notice>}

      <Card title="Photos" aside={<span className="text-xs text-muted">{photos.length}/{MAX_PHOTOS}</span>}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo, i) => (
            <div key={photo.key} className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-photo">
              <img src={photo.url} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-[10px] font-extrabold text-white">COVER</span>}
              <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)} className="absolute right-1 top-1 flex size-8 items-center justify-center rounded-full bg-white/95">
                <CloseIcon size={16} />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between">
                <button type="button" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => movePhoto(i, -1)} className="flex size-8 items-center justify-center rounded-full bg-white/95 disabled:invisible">
                  <ArrowLeftIcon size={16} />
                </button>
                <button type="button" aria-label={`Move photo ${i + 1} later`} disabled={i === photos.length - 1} onClick={() => movePhoto(i, 1)} className="flex size-8 items-center justify-center rounded-full bg-white/95 disabled:invisible">
                  <ArrowRightIcon size={16} />
                </button>
              </div>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <label className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-[#9a9a92] bg-white text-xs font-bold text-body">
              <PlusIcon />
              {preparing ? 'Preparing…' : 'Add photos'}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={preparing} onChange={(e) => void addPhotos(e.target.files).then(() => (e.target.value = ''))} />
            </label>
          )}
        </div>
        <span className="text-xs text-muted">The first photo is the cover. Photos are shrunk before upload to save data.</span>
      </Card>

      <Card>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Name
          <input className={fieldClass} required maxLength={80} placeholder="e.g. Oxford Shirt, Sky Blue" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Category
          <select className={fieldClass} value={categoryId} onChange={(e) => changeCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-extrabold">
          Description
          <textarea rows={3} maxLength={1000} placeholder="Fabric, fit, condition" value={description} onChange={(e) => setDescription(e.target.value)} className={`${fieldClass} h-auto py-2.5`} />
        </label>
      </Card>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            MRP (optional)
            <input className={fieldClass} inputMode="numeric" placeholder="₹" value={mrp} onChange={(e) => setMrp(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Selling price
            <input className={`${fieldClass} border-ink`} inputMode="numeric" required placeholder="₹" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </label>
        </div>
      </Card>

      <Card title="Sizes and stock" aside={<span className="text-xs font-bold">{total} {total === 1 ? 'piece' : 'pieces'} total</span>}>
        {sizes.length === 0 ? (
          <p className="m-0 text-sm text-muted">This category has no sizes yet. Add them under Categories.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {sizes.map((s, i) => (
              <li key={s.size} className="flex items-center justify-between border-b border-[#f0f0ec] py-1.5 last:border-0">
                <span className="min-w-12 text-[15px] font-extrabold">{s.size}</span>
                <Stepper label={s.size} value={s.stock} onChange={(n) => setSizes((rows) => rows.map((r, j) => (j === i ? { ...r, stock: n } : r)))} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <Toggle label="Show in shop" checked={visible} onChange={setVisible} />
        <Toggle label="Show SALE tag" checked={onSale} onChange={setOnSale} />
        <p className="m-0 -mt-2 text-xs font-semibold text-muted">New products show a NEW tag for their first 7 days by themselves.</p>
      </Card>

      {message && <Notice kind={message.kind}>{message.text}</Notice>}

      <PrimaryButton type="submit" disabled={saving || preparing}>
        {saving ? 'Saving…' : product ? 'Save changes' : 'Save and show in shop'}
      </PrimaryButton>
      {product && (
        <button type="button" disabled={saving} onClick={() => void deleteProduct()} className="min-h-11 text-sm font-bold text-danger underline underline-offset-4">
          Delete product
        </button>
      )}
    </form>
  )
}
