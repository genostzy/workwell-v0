'use client'

import { useState } from 'react'

type Account = {
  user_id: string
  email: string
  full_name: string | null
  plane: string | null
  created_at: string
  is_active: boolean
  last_sign_in: string | null
}

export function AccountTable({
  accounts,
  onDeactivate,
}: {
  accounts: Account[]
  onDeactivate: (userId: string) => Promise<void>
}) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleDeactivate = async (userId: string, email: string) => {
    if (!confirm(`Deactivate ${email}? They will lose access to WorkWell.`)) return
    setLoading(userId)
    await onDeactivate(userId)
    setLoading(null)
  }

  const activeAccounts = accounts.filter((a) => a.is_active)

  if (activeAccounts.length === 0) {
    return (
      <div className="card">
        <p className="t-subtle" style={{ padding: 'var(--s-4)' }}>
          No active accounts.
        </p>
      </div>
    )
  }

  return (
    <div className="card card--flush">
      <div style={{ padding: 'var(--s-5) var(--s-5) var(--s-3)' }}>
        <div className="card__title">Active accounts</div>
        <div className="card__sub">{activeAccounts.length} people</div>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <caption className="sr-only">Account management</caption>
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Name</th>
              <th scope="col">Plane</th>
              <th scope="col">Joined</th>
              <th scope="col">Last sign-in</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeAccounts.map((acc) => (
              <tr key={acc.user_id}>
                <td>{acc.email}</td>
                <td style={{ fontWeight: 600 }}>{acc.full_name ?? '—'}</td>
                <td>
                  <span
                    className={`chip ${acc.plane === 'hr' ? 'chip--accent' : ''}`}
                  >
                    {acc.plane === 'hr' ? 'HR' : acc.plane === 'private' ? 'Private' : '—'}
                  </span>
                </td>
                <td>
                  {new Date(acc.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td>
                  {acc.last_sign_in
                    ? new Date(acc.last_sign_in).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : 'Never'}
                </td>
                <td>
                  <button
                    className="btn btn--ghost btn--sm"
                    disabled={loading === acc.user_id}
                    onClick={() => handleDeactivate(acc.user_id, acc.email)}
                  >
                    {loading === acc.user_id ? '...' : 'Deactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
