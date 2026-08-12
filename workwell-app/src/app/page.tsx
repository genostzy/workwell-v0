import { createClient } from '@/lib/supabase/server'
import { Office } from '@/components/office'
import { SignInRoom } from '@/components/sign-in-room'
import { Shell, PageHead } from '@/components/chrome'
import { RequestAccess } from '@/components/request-access'

export default async function Home() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  // Signed out, the office is seen from outside: dimmed, inert, with one
  // live thing in it. A landing page with a Sign in button would have been
  // a second, plainer product bolted in front of this one.
  if (!claims) return <SignInRoom />

  const { data: me, error: meError } = await supabase
    .from('me')
    .select('full_name, plane')
    .maybeSingle()

  // A query that FAILED and a query that found nothing are different
  // things, and conflating them sent us hunting for a missing invitation
  // when the real cause was a permission error on the view.
  if (meError) {
    return (
      <Shell current="home">
        <PageHead title="Something went wrong reading your account" />
        <div className="card">
          <div className="state state--error">
            <div className="state__icon" aria-hidden="true">
              ⚠️
            </div>
            <h2 className="state__title">Your record could not be loaded</h2>
            <p className="state__text">
              Your history is safe — this is a read failing, not data missing.
            </p>
            <p className="t-subtle mt-3">
              <code>{meError.message}</code>
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  if (!me) {
    return (
      <Shell current="home">
        <PageHead
          title="You're signed in"
          lead="An account is not access yet. Ask, and whoever runs WorkWell where you work decides."
        />
        <RequestAccess />
      </Shell>
    )
  }

  if (!me.plane) {
    return (
      <Shell current="home">
        <PageHead
          title="Awaiting assignment"
          lead="An admin will assign your plane shortly. You'll receive access once assigned."
        />
        <div className="card">
          <div className="state state--info">
            <div className="state__icon" aria-hidden="true">
              ⏳
            </div>
            <h2 className="state__title">Waiting for admin</h2>
            <p className="state__text">
              You are signed in, but an admin needs to assign you to either
              the Private plane (employee) or HR plane before you can continue.
              This usually happens within a day.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  // The office is the interface, not a menu. The room is the navigation
  // surface; the plain list beside it is never optional.
  return <Office isHr={isHr} name={me.full_name} />
}
