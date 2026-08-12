import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PageHead, PlaneBadge, PrivacyNote, Shell } from '@/components/chrome'
import { Decide } from './decide'
import { AccessRequests } from './requests'

function fmt(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export default async function Hr() {
  const supabase = await createClient()

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) {
    return (
      <Shell current="hr" plane="private">
        <PageHead title="Not available on this account" />
        <div className="card">
          <div className="state">
            <div className="state__icon" aria-hidden="true">
              🔒
            </div>
            <h2 className="state__title">This area is for HR</h2>
            <p className="state__text">
              Your own data lives on the private plane, which nobody here can
              read.
            </p>
          </div>
        </div>
      </Shell>
    )
  }

  const { data: people } = await supabase
    .from('people')
    .select('id, full_name, status')
    .order('full_name')

  const { data: employment } = await supabase
    .from('employment')
    .select('person_id, job_title, department')

  const { data: leave } = await supabase
    .from('leave_requests')
    .select('id, person_id, kind, starts_on, ends_on, note, status')
    .order('created_at', { ascending: false })

  const { data: requests } = await supabase
    .from('access_requests')
    .select('id, email, full_name, note, created_at, status')
    .eq('status', 'pending')
    .order('created_at')

  const byPerson = new Map((employment ?? []).map((e) => [e.person_id, e]))
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]))
  const pending = (leave ?? []).filter((l) => l.status === 'pending')

  return (
    <Shell current="hr" plane="org">
      <PageHead
        title="People"
        lead="Employment records for everyone at your organisation."
      />

      <PlaneBadge plane="work" />

      <PrivacyNote
        plane="work"
        detail="Mood, energy, pressure, notes and check-in history live on each person's private plane. There is no policy anywhere granting this account access to them — not a filtered view, no access at all. Asking for a day off says nothing about how someone is."
      >
        <b>Employment data only.</b>{' '}
      </PrivacyNote>

      <AccessRequests requests={requests ?? []} />

      <div className="grid grid--3 mb-5">
        <div className="stat">
          <span className="stat__label">Headcount</span>
          <span className="stat__value t-num">{(people ?? []).length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Leave to approve</span>
          <span className="stat__value t-num">{pending.length}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Wellbeing records visible</span>
          <span className="stat__value t-num">0</span>
        </div>
      </div>

      <Link href="/hr/accounts" className="btn btn--secondary mb-5">
        Manage accounts
      </Link>

      <div className="card">
        <div className="card__head">
          <div>
            <div className="card__title">Leave to approve</div>
            <div className="card__sub">Awaiting a decision from you</div>
          </div>
        </div>
        {pending.length === 0 ? (
          <p className="t-subtle">Nothing waiting on you.</p>
        ) : (
          <div className="stack">
            {pending.map((l) => (
              <div className="card card--quiet" key={l.id} style={{ margin: 0 }}>
                <div className="row row--between">
                  <b>{names.get(l.person_id) ?? 'Someone'}</b>
                  <span className="chip">{l.kind}</span>
                </div>
                <p className="t-subtle mt-2">
                  {fmt(l.starts_on)} – {fmt(l.ends_on)}
                </p>
                {l.note && <p className="t-subtle">{l.note}</p>}
                <Decide id={l.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card--flush mt-5">
        <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
          <div className="card__title">Directory</div>
          <div className="card__sub">{(people ?? []).length} people</div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Employee directory</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Title</th>
                <th scope="col">Department</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {(people ?? []).map((p) => {
                const e = byPerson.get(p.id)
                return (
                  <tr key={p.id}>
                    <th scope="row" style={{ fontWeight: 600 }}>
                      {p.full_name}
                    </th>
                    <td>{e?.job_title ?? '—'}</td>
                    <td>{e?.department ?? '—'}</td>
                    <td>
                      <span
                        className={
                          p.status === 'active' ? 'chip chip--accent' : 'chip'
                        }
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  )
}
