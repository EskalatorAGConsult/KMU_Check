import type { ReactNode } from 'react'

/** Gemeinsame UI-Primitive der Journey (MABE-CI, White-Mode, Fokus-Ringe). */

export const inputCls =
  'w-full rounded-xl border border-olive-300 bg-white px-4 py-3 text-base text-mabe-900 placeholder:text-olive-400 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:bg-olive-50'

export const labelCls = 'mb-1.5 block text-sm font-semibold text-mabe-900'

export function Feld({
  label,
  hilfe,
  fehler,
  pflicht,
  children,
}: {
  label: string
  hilfe?: string
  fehler?: string
  pflicht?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {pflicht && <span className="ml-1 text-teal-700" aria-hidden>*</span>}
      </label>
      {children}
      {hilfe && !fehler && <p className="mt-1.5 text-xs/5 text-olive-500">{hilfe}</p>}
      {fehler && (
        <p className="mt-1.5 text-xs/5 font-medium text-red-700" role="alert">
          {fehler}
        </p>
      )}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  fehler,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  fehler?: string
}) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-olive-200 bg-white p-4 hover:border-teal-500">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-teal-600"
        />
        <span className="text-sm/6 text-olive-800">{label}</span>
      </label>
      {fehler && (
        <p className="mt-1.5 text-xs/5 font-medium text-red-700" role="alert">
          {fehler}
        </p>
      )}
    </div>
  )
}
