import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shell, PageHead } from '@/components/chrome'
import { PlaneAssignment } from '@/components/admin/plane-assignment'

export default async function AdminAssignmentsPage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) redirect('/sign-in')

  const { data: me } = await supabase
    .from('me')
    .select('full_name')
    .maybeSingle()

  if (!me) redirect('/')

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isAdmin = (roles ?? []).some((r) => r.role === 'admin')

  if (!isAdmin) redirect('/')

  const { data: pendingUsers } = await supabase.rpc('admin_pending_assignments')

  return (
    <Shell current="home">
      <PageHead
        title="Plane Assignments"
        lead="Assign users to Private or HR plane. Users cannot choose their own plane."
      />
      <PlaneAssignment
        pendingUsers={pendingUsers ?? []}
        onComplete={() => window.location.reload()}
      />
    </Shell>
  )
}
