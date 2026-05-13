import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../store/authStore'
import { getAdminSitePages, patchAdminSitePage, type AdminSitePageRow } from '../../../api/admin'

const KEY_LABEL: Record<string, string> = {
  about: 'О сервисе — страница /about',
  terms: 'Пользовательское соглашение — /terms',
  privacy: 'Политика конфиденциальности — /privacy',
}

export default function SiteSettingsTab() {
  const { token } = useAuth()
  const isApi = Boolean(token && token !== 'local-dev')
  const [pages, setPages] = useState<AdminSitePageRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, { title: string; bodyHtml: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!isApi || !token) {
      setLoading(false)
      return
    }
    setErr(null)
    try {
      const { pages: p } = await getAdminSitePages(token)
      setPages(p)
      const d: Record<string, { title: string; bodyHtml: string }> = {}
      for (const row of p) {
        d[row.key] = { title: row.title, bodyHtml: row.bodyHtml }
      }
      setDrafts(d)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [token, isApi])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (key: string) => {
    if (!token || !isApi) return
    const dr = drafts[key]
    if (!dr) return
    setSaving(key)
    setMsg(null)
    setErr(null)
    try {
      const updated = await patchAdminSitePage(token, key, { title: dr.title, bodyHtml: dr.bodyHtml })
      setMsg(`Сохранено: ${KEY_LABEL[key] ?? key}`)
      setPages((prev) => prev.map((p) => (p.key === key ? updated : p)))
      setDrafts((prev) => ({ ...prev, [key]: { title: updated.title, bodyHtml: updated.bodyHtml } }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(null)
    }
  }

  if (!isApi) {
    return <p className="p-4 text-sm text-slate-500">Нужна авторизация API.</p>
  }

  if (loading) {
    return <p className="p-4 text-sm text-slate-500">Загрузка…</p>
  }

  return (
    <div className="p-3 space-y-4">
      {msg ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-500 dark:text-red-400">{err}</p> : null}
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Разрешён безопасный HTML (без скриптов). Для «Соглашения», если текст пустой, на сайте показывается
        встроенный шаблон.
      </p>
      {pages.map((row) => (
        <div
          key={row.key}
          className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2"
        >
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            {KEY_LABEL[row.key] ?? row.key}
          </h4>
          <label className="block text-[11px] text-slate-500 dark:text-slate-400">
            Заголовок на странице
            <input
              type="text"
              value={drafts[row.key]?.title ?? ''}
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [row.key]: {
                    title: e.target.value,
                    bodyHtml: prev[row.key]?.bodyHtml ?? '',
                  },
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-[11px] text-slate-500 dark:text-slate-400">
            HTML-содержимое
            <textarea
              value={drafts[row.key]?.bodyHtml ?? ''}
              onChange={(e) =>
                setDrafts((prev) => ({
                  ...prev,
                  [row.key]: {
                    title: prev[row.key]?.title ?? '',
                    bodyHtml: e.target.value,
                  },
                }))
              }
              rows={row.key === 'terms' ? 16 : 12}
              spellCheck={false}
              className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 resize-y min-h-[120px]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void save(row.key)}
              disabled={saving === row.key}
              className="rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              {saving === row.key ? 'Сохранение…' : 'Сохранить'}
            </button>
            <span className="text-[10px] text-slate-400">
              Обновлено:{' '}
              {row.updatedAt
                ? new Date(row.updatedAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
