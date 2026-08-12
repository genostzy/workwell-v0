'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PendingUser = {
  user_id: string
  email: string
  full_name: string | null
  created_at: string
  has_plane: boolean
}

export function PlaneAssignment({
  pendingUsers,
  onComplete,
}: {
  pendingUsers: PendingUser[]
  onComplete: () => void
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const assignPlane = async (userId: string, plane: 'private' | 'hr') => {
    setLoading(userId)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('admin_assign_plane', {
      p_user_id: userId,
      p_plane: plane,
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(null)
      return
    }

    setLoading(null)
    onComplete()
  }

  const needsAssignment = pendingUsers.filter((u) => !u.has_plane)

  if (needsAssignment.length === 0) {
    return (
      <div className="card">
        <div className="state state--info">
          <div className="state__icon" aria-hidden="true">
            ✓
          </div>
          <h2 className="state__title">All caught up</h2>
          <p className="state__text">
            Every user has been assigned a plane.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      {error && (
        <div className="banner banner--error mb-4" role="alert">
          {error}
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Joined</th>
            <th>Assign Plane</th>
          </tr>
        </thead>
        <tbody>
          {needsAssignment.map((user) => (
            <tr key={user.user_id}>
              <td>{user.email}</td>
              <td>{user.full_name ?? '—'}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn--primary btn--sm"
                    disabled={loading === user.user_id}
                    onClick={() => assignPlane(user.user_id, 'private')}
                  >
                    {loading === user.user_id ? '...' : 'Private'}
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    disabled={loading === user.user_id}
                    onClick={() => assignPlane(user.user_id, 'hr')}
                  >
                    {loading === user.user_id ? '...' : 'HR'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
