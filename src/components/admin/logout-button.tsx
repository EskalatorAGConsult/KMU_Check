'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { authClient } from '@/lib/auth/client'

export function LogoutButton() {
  const router = useRouter()
  const [busy, startTransition] = useTransition()
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut()
          router.push('/admin/login')
          router.refresh()
        })
      }
      className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-olive-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
    >
      Abmelden
    </button>
  )
}
