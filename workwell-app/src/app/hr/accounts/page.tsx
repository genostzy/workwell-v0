import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Shell, PageHead } from '@/components/chrome'
import { AccountTable } from '@/components/admin/account-table'

export default async function HRAccountsPage() {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()

  if (!claims) redirect('/sign-in')

  const { data: me } = await supabase
    .from('me')
    .select('full_name')
    .maybeSingle()

  if (!me) redirect('/')

  const { data: roles } = await supabase.from('person_roles').select('role')
  const isHr = (roles ?? []).some((r) => r.role === 'hr')

  if (!isHr) redirect('/')

  const { data: accounts } = await supabase.rpc('admin_list_accounts')

  return (
    <Shell current="hr" plane="org">
      <PageHead
        title="Account Management"
        lead="View and manage all accounts in your organisation."
      />
      <AccountTable
        accounts={accounts ?? []}
        onDeactivate={async (userId) => {
          'use server'
          const supabase = await createClient()
          await supabase.rpc('admin_deactivate_account', {
            p_user_id: userId,
          })
        }}
      />
    </Shell>
  )
}
