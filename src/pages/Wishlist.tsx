import { Page } from '../components/Page'
import { SavedGrid } from '../components/SavedGrid'
import { useAuth } from '../lib/auth'
import { useWishlist } from '../lib/wishlist'
import { Link } from 'react-router'

/** Everything the shopper has hearted. Works logged out too (kept on the phone). */
export function Wishlist() {
  const { session } = useAuth()
  const { order } = useWishlist()
  return (
    <Page title="Your wishlist">
      <div className="flex flex-col gap-5">
        {!session && order.length > 0 && (
          <p className="m-0 bg-surface px-3.5 py-3 text-sm text-body">
            Saved on this phone.{' '}
            <Link to="/login?next=%2Fwishlist" className="font-extrabold text-ink underline underline-offset-4">
              Log in
            </Link>{' '}
            to keep them in your account.
          </p>
        )}
        <SavedGrid />
      </div>
    </Page>
  )
}
