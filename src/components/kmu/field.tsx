'use client'

import { clsx } from 'clsx/lite'
import { useState, type ReactNode } from 'react'

/** Eingabefeld mit Label und aufklappbarer „Warum wir das fragen“-Erläuterung. */
export function Field({
  label,
  htmlFor,
  why,
  children,
  hint,
  required,
}: {
  label: string
  htmlFor?: string
  why?: ReactNode
  hint?: ReactNode
  children: ReactNode
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-olive-950">
          {label} {required && <span className="text-teal-700">*</span>}
        </label>
        {why && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
                clipRule="evenodd"
              />
            </svg>
            Warum?
          </button>
        )}
      </div>
      {children}
      {hint && <p className="text-xs text-olive-500">{hint}</p>}
      {why && open && (
        <div className="rounded-xl bg-teal-50 px-3.5 py-3 text-xs leading-relaxed text-teal-900 ring-1 ring-teal-600/15">
          {why}
        </div>
      )}
    </div>
  )
}

export const inputClass =
  'w-full rounded-xl border border-olive-300 bg-white px-3.5 py-3 text-base text-olive-950 outline-none transition placeholder:text-olive-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30'

/** Numerisches Eingabefeld mit Suffix-Adornment (€, MA …). */
export function NumberField({
  id,
  value,
  onChange,
  placeholder,
  suffix,
  invalid,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suffix?: string
  invalid?: boolean
}) {
  return (
    <div
      className={clsx(
        'flex items-stretch overflow-hidden rounded-xl border bg-white transition',
        invalid
          ? 'border-red-500 ring-2 ring-red-500/30'
          : 'border-olive-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/30',
      )}
    >
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-3.5 py-3 text-base text-olive-950 outline-none placeholder:text-olive-400"
      />
      {suffix && (
        <span className="flex shrink-0 items-center border-l border-olive-200 bg-olive-50 px-3.5 text-sm font-medium text-olive-600">
          {suffix}
        </span>
      )}
    </div>
  )
}
