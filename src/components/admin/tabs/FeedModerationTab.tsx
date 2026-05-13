import { useCallback, useEffect, useState } from 'react'
import {
  getAdminPublishBans,
  postAdminRestorePublishBan,
  postAdminDismissPublishBan,
  type AdminPublishBanRow,
} from '../../../api/admin'
import { useAuth } from '../../../store/authStore'

export default function FeedModerationTab() {
  const { token } = useAuth()
  const [bans, setBans] = useState<AdminPublishBanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<'restore' | 'dismiss' | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setErr(null)
    setLoading(true)
    try {
      const b = await getAdminPublishBans(token, { limit: 120 })
      setBans(b.items)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function restore(id: string) {
    if (!token) return
    setBusyId(id)
    setBusyAction('restore')
    setErr(null)
    try {
      await postAdminRestorePublishBan(token, id)
      setBans((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  async function dismiss(id: string) {
    if (!token) return
    setBusyId(id)
    setBusyAction('dismiss')
    setErr(null)
    try {
      await postAdminDismissPublishBan(token, id)
      setBans((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyId(null)
      setBusyAction(null)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Работы, снятые с общей ленты: можно разрешить публикацию снова («Восстановить») или убрать из этого списка
        («Очистить») — запись для вас исчезнет, а запрет публикации сохранится; вернуть из админки будет нельзя.
      </p>
      {err ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-100">
          {err}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-slate-500">Загрузка…</p> : null}
      <div className="space-y-2">
        {bans.map((it) => (
          <div
            key={it.id}
            className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200/80 dark:border-amber-900/35 bg-amber-50/70 dark:bg-amber-950/20 p-3"
          >
            {it.thumbUrl ? (
              <img src={it.thumbUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover bg-slate-100" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 text-[10px] text-amber-900/70">
                {it.mode}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs text-amber-900/90 dark:text-amber-100/90">
                {it.authorTag ?? it.authorName ?? `${it.authorUserId.slice(0, 8)}…`} · {it.modelLabel} · {it.mode}
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-100 line-clamp-2">{it.promptPreview}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {new Date(it.createdAt).toLocaleString('ru-RU')} · <span className="font-mono break-all">{it.id}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === it.id}
                onClick={() => void restore(it.id)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {busyId === it.id && busyAction === 'restore' ? '…' : 'Восстановить'}
              </button>
              <button
                type="button"
                disabled={busyId === it.id}
                onClick={() => void dismiss(it.id)}
                className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-500 dark:hover:bg-slate-400"
              >
                {busyId === it.id && busyAction === 'dismiss' ? '…' : 'Очистить'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {!loading && bans.length === 0 ? (
        <p className="text-sm text-slate-500">Нет заблокированных публикаций в списке.</p>
      ) : null}
    </div>
  )
}
