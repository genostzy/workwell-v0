'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Brandmark } from '@/components/brandmark'

/**
 * Signing in, as the Hi-Fi design draws it.
 *
 * The office is the product, so the signed-out state is the office seen
 * from outside: the plan is dimmed, every destination is inert, and the one
 * live thing is the front door. Clicking it raises the sign-in sheet. A
 * plain list sits beside the room for anyone who cannot use the picture,
 * with its own way in — the room must never be the only door.
 *
 * The prototype signed in by picking a demo account. Here the same sheet
 * asks for an address and sends a real magic link, so the three steps are
 * ask, send, then wait for the mail.
 */

type Step = 'ask' | 'sending' | 'sent'
type AuthMode = 'login' | 'signup'

const REMEMBER = 'ww.email'
const RESEND_SECONDS = 45

/** Supabase's messages are written for developers. These are the ones a
 *  person signing in can actually act on. */
function readable(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('rate limit') || /after \d+ seconds/.test(m))
    return 'Too many requests just now. Give it a minute and try again.'
  if (m.includes('signups not allowed') || m.includes('not authorized'))
    return 'That address cannot sign in yet. Whoever runs WorkWell where you work has to invite it first.'
  if (m.includes('invalid') && m.includes('email'))
    return 'That does not look like an email address.'
  return message
}

export function SignInRoom({
  openOnLoad = false,
  notice,
}: {
  openOnLoad?: boolean
  /** Something that went wrong before this page loaded — a dead link, say. */
  notice?: string
}) {
  const roomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const doorRef = useRef<Element | null>(null)

  const [view, setView] = useState<'room' | 'list'>('room')
  const [open, setOpen] = useState(openOnLoad)
  const [step, setStep] = useState<Step>('ask')
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(notice ?? null)
  const [cooldown, setCooldown] = useState(0)

  /* ------------------------------------------------------------- The room */

  const build = useCallback(() => {
    const WW = window.WW
    if (!WW?.room || !roomRef.current) return

    const minutes = WW.room.nowMinutes()
    roomRef.current.innerHTML =
      WW.room.roomSVG({ role: 'employee', minutes }) +
      '<div class="room__dim"></div>'

    // `locked` here is the same gate the room honours: before sign-in these
    // must not be live links, or the list is a way around the front door.
    if (listRef.current) {
      listRef.current.innerHTML = WW.room.roomList('employee', true)
    }
  }, [])

  useEffect(() => {
    if (window.WW?.room) build()

    // sky.js appends to document.body and never takes it away. React does
    // not own that node, so it has to be removed by hand or it paints over
    // whatever screen comes next.
    return () => {
      document.querySelectorAll('.sky').forEach((el) => el.remove())
      document.body.classList.remove('has-sky')
    }
  }, [build])

  // On a phone the plan scales down until its labels are ~13px and the tap
  // targets are far under 44px, so the list is simply the better small
  // screen. Decided after mount: the server cannot know the viewport, and
  // guessing here would be a hydration mismatch.
  useEffect(() => {
    if (window.matchMedia('(max-width: 760px)').matches) setView('list')
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER)
      if (saved) setEmail(saved)
    } catch {
      // Private browsing. Not remembering an address is not an error.
    }
  }, [])

  /* ------------------------------------------------------------ The sheet */

  const openSheet = useCallback((from?: Element | null) => {
    doorRef.current = from ?? null
    setError(null)
    setStep((s) => (s === 'sending' ? 'ask' : s))
    setOpen(true)
  }, [])

  const closeSheet = useCallback(() => {
    setOpen(false)
    // Send focus back where it came from, or it lands on <body> and the
    // room has to be tabbed through again. Opened straight from the URL
    // there is no origin, so hand it to the door — the way back in.
    const back =
      (doorRef.current as HTMLElement | null) ??
      roomRef.current?.querySelector<SVGElement>('[data-frontdoor]')
    back?.focus?.()
  }, [])

  useEffect(() => {
    if (!open) return
    if (step === 'ask') emailRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, step, closeSheet])

  // Resending immediately does nothing useful — the first mail is usually
  // still in flight — and Supabase refuses it anyway. Say how long instead
  // of letting the button fail.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const send = useCallback(
    async (address: string) => {
      const clean = address.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        setError('That does not look like an email address.')
        return
      }

      setError(null)
      setStep('sending')

      // `next` is read from the URL rather than with useSearchParams, which
      // would make this page dynamic for something only needed at submit.
      const next = new URLSearchParams(location.search).get('next')
      const callback = new URL('/auth/callback', location.origin)
      if (next) callback.searchParams.set('next', next)

      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: callback.toString() },
      })

      if (error) {
        setError(readable(error.message))
        setStep('ask')
        return
      }

      if (mode === 'signup') {
        await supabase.from('access_requests').insert({
          email: clean,
          status: 'pending',
        })
      }

      try {
        localStorage.setItem(REMEMBER, clean)
      } catch {
        // Nothing to do; the address is still in state for this visit.
      }
      setEmail(clean)
      setCooldown(RESEND_SECONDS)
      setStep('sent')
    },
    [mode]
  )

  /* ------------------------------------------------------------- Wiring */

  const onRoomClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Everything in a locked room leads to the same place. The prototype
      // let a click on a dimmed destination do nothing at all, which reads
      // as broken rather than as locked.
      const el = target.closest('[data-frontdoor], .spot')
      if (!el) return
      e.preventDefault()
      openSheet(el)
    },
    [openSheet]
  )

  const onRoomKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
      if (!(e.target as HTMLElement).closest('[data-frontdoor], .spot')) return
      onRoomClick(e)
    },
    [onRoomClick]
  )

  return (
    <>
      {/* room before sky: sky.js reads WW.room for the current minute. */}
      <Script src="/prototype/room.js" strategy="afterInteractive" />
      <Script
        src="/prototype/sky.js"
        strategy="afterInteractive"
        onReady={build}
      />

      <div className={`room-shell${view === 'room' ? ' is-fit' : ''}`}>
        <header className="room-top">
          <div className="room-top__brand">
            <Brandmark size={30} showAttribution />
            <span className="room-top__name">WorkWell</span>
          </div>
          <span className="room-top__spacer" />
          <div className="segmented" role="group" aria-label="How to navigate">
            <button
              type="button"
              aria-pressed={view === 'room'}
              onClick={() => setView('room')}
            >
              Room
            </button>
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
          <button
            className="btn btn--primary btn--sm"
            type="button"
            onClick={() => openSheet()}
          >
            Sign in
          </button>
        </header>

        <main className="room-stage">
          <div
            className={`room-views${view === 'room' ? ' is-on' : ''}`}
            data-view-panel="room"
            hidden={view !== 'room'}
          >
            <p className="t-lead t-center">Click the front door to sign in.</p>
            <div
              className="room"
              data-room
              data-open="false"
              ref={roomRef}
              onClick={onRoomClick}
              onKeyDown={onRoomKey}
            />
          </div>

          {/* A picture must never be the only way in. */}
          <div
            className={`room-views${view === 'list' ? ' is-on' : ''}`}
            data-view-panel="list"
            hidden={view !== 'list'}
            style={{ width: 'min(560px, 100%)' }}
          >
            <h1 className="mb-2" style={{ fontSize: 'var(--fs-xl)' }}>
              Where would you like to go?
            </h1>
            <p className="t-subtle mb-4">Sign in at the front door first.</p>
            <button
              className="btn btn--primary btn--block mb-4"
              type="button"
              onClick={() => openSheet()}
            >
              Sign in to come in
            </button>
            <div ref={listRef} />
          </div>
        </main>
      </div>

      {open && (
        <div
          className="sheet-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeSheet()
          }}
        >
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Sign in"
            style={{ maxWidth: 420 }}
          >
            <div className="auth__card" style={{ padding: 'var(--s-6)' }}>
              {step === 'ask' && (
                <>
                  <div className="auth__tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'login'}
                      className={`auth__tab${mode === 'login' ? ' is-active' : ''}`}
                      onClick={() => setMode('login')}
                    >
                      Log in
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === 'signup'}
                      className={`auth__tab${mode === 'signup' ? ' is-active' : ''}`}
                      onClick={() => setMode('signup')}
                    >
                      Sign up
                    </button>
                  </div>

                  <h2 className="auth__title">
                    {mode === 'login' ? 'Come in' : 'Create your account'}
                  </h2>
                  <p className="auth__sub">
                    {mode === 'login'
                      ? 'We email you a link. No password to remember, none to leak.'
                      : "We'll email you a verification link. An admin will approve your access."}
                  </p>

                  {error && (
                    <div className="banner banner--error mb-4" role="alert">
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      send(email)
                    }}
                  >
                    <div className="field">
                      <label className="field__label" htmlFor="signin-email">
                        Work email
                      </label>
                      <input
                        className="input"
                        id="signin-email"
                        ref={emailRef}
                        type="email"
                        name="email"
                        autoComplete="email"
                        inputMode="email"
                        enterKeyHint="send"
                        spellCheck={false}
                        placeholder="you@company.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <button
                      className="btn btn--primary btn--block mt-4"
                      type="submit"
                    >
                      {mode === 'login' ? 'Send me a link' : 'Request access'}
                    </button>
                  </form>

                  <p className="auth__foot mt-4">
                    🔒 What you record in WorkWell is yours. Your employer
                    never sees it.
                  </p>

                  <button
                    className="auth__alt"
                    type="button"
                    onClick={closeSheet}
                  >
                    Not now
                  </button>
                </>
              )}

              {step === 'sending' && (
                <div className="state">
                  <div className="auth__spinner" aria-hidden="true" />
                  <p className="state__text" role="status">
                    Sending your link…
                  </p>
                </div>
              )}

              {step === 'sent' && (
                <div className="state state--info">
                  <div className="state__icon" aria-hidden="true">
                    ✉️
                  </div>
                  <h2 className="state__title">Check your email</h2>
                  <p className="state__text" role="status">
                    The link is on its way to <b>{email}</b>. Opening it brings
                    you straight in.
                  </p>
                  <p className="t-subtle">
                    Nothing yet? It can take a minute, and it sometimes lands
                    in spam.
                  </p>
                  <div className="state__actions row">
                    <button
                      className="btn btn--secondary btn--sm"
                      type="button"
                      disabled={cooldown > 0}
                      onClick={() => send(email)}
                    >
                      {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send again'}
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      type="button"
                      onClick={() => {
                        setStep('ask')
                        setError(null)
                      }}
                    >
                      Use a different address
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
