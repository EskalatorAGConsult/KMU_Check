import { clsx } from 'clsx/lite'
import Image from 'next/image'
import type { ComponentProps } from 'react'

/**
 * Offizielles MABE-SMART-CONTROL-Logo (Originaldatei, 1752 × 427 px).
 * Liegt unter public/mabe-smart-control-logo.png – bei einer neuen
 * Logo-Version nur diese Datei ersetzen.
 */
export function MabeLogo({ className, ...props }: Omit<ComponentProps<typeof Image>, 'src' | 'alt' | 'width' | 'height'>) {
  return (
    <Image
      src="/mabe-smart-control-logo.png"
      alt="MABE SMART CONTROL"
      width={1752}
      height={427}
      priority
      className={clsx('w-auto', className)}
      {...props}
    />
  )
}
