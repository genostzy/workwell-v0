import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'

// Order matters: tokens define the variables everything else reads, base
// resets and sets typography, layout builds the shell, components sit on
// top. globals.css last so its overrides win.
import '@/styles/tokens.css'
import '@/styles/base.css'
import '@/styles/layout.css'
import '@/styles/components.css'
import '@/styles/signin.css'
import '@/styles/room.css'
import '@/styles/sky.css'
import './globals.css'

// The prototype's typeface. Loaded through next/font so it is self-hosted
// and does not block on a third-party request.
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WorkWell — by AxionHR',
  description:
    'Employee wellbeing, with the boundary between you and your employer enforced in the database.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={nunito.variable}>
      <body>{children}</body>
    </html>
  )
}
