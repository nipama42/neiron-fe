import { useState, useRef } from 'react'
import { useAuth } from '../../../store/authStore'
import { getAdminUserSearch, deleteAdminUser, type AdminUserRow } from '../../../api/admin'

export default function UsersTab() {
  const { token } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminUserRow[]>([])
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInput = (val: string) => {
    setQuery(val)
    setSearchErr(null)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (val.trim().length < 2) { setResults([]); return }
    timerRef.current = setTimeout(() => void doSearch(val), 400)
  }

  async function doSearch(q: string) {
    if (!token) return
    setSearching(true)
    setSearchErr(null)
    try {
      const users = await getAdminUserSearch(token, q)
      setResults(users)
    } catch (e) {
      setSearchErr(e instanceof Error ? e.message : 'Ошибка поиска')
    } finally {
      setSearching(false)
    }
  }

  async function handleDelete(userId: string) {
    if (!token) return
    setDeleting(true)
    setDelErr(null)
    try {
      await deleteAdminUser(token, userId)
      setDeletedIds((prev) => new Set([...prev, userId]))
      setResults((prev) => prev.filter((u) => u.id !== userId))
      setConfirmId(null)
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setDeleting(false)
    }
  }

  const userToDelete = results.find((u) => u.id === confirmId)

  return (
    <div className="p-3 max-w-2xl">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Поиск и удаление пользователей
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Email, логин, @тег, имя или ID…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          className="flex-1 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-[var(--color-body)] text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-slate-400/40"
        />
        <button
          type="button"
          onClick={() => void doSearch(query)}
          disabled={searching || query.trim().length < 2}
          className="bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {searching ? '…' : 'Найти'}
        </button>
      </div>

      {searchErr && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{searchErr}</p>
      )}

      {results.length === 0 && !searching && query.trim().length >= 2 && !searchErr && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Пользователи не найдены</p>
      )}

      <div className="flex flex-col gap-2">
        {results.map((u) => (
          <div
            key={u.id}
            className="bg-surface border border-slate-200 dark:border-slate-600 rounded-xl p-3 flex items-start justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-1.5 mb-1">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {u.displayName || u.telegramName || u.login || u.email || 'Без имени'}
                </span>
                {u.isAdmin && (
                  <span className="text-[10px] font-bold bg-violet-600 text-white rounded-full px-2 py-0.5">
                    ADMIN
                  </span>
                )}
                {u.hasPartner && (
                  <span className="text-[10px] font-bold bg-emerald-600 text-white rounded-full px-2 py-0.5">
                    ПАРТНЁР
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                {u.email && <span>{u.email}</span>}
                {u.telegramUsername && <span>@{u.telegramUsername}</span>}
                {u.publicTag && <span>#{u.publicTag}</span>}
                <span>{u.credits} кр.</span>
                <span className="text-slate-400 dark:text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5 break-all">{u.id}</p>
            </div>
            <button
              type="button"
              onClick={() => { setConfirmId(u.id); setDelErr(null) }}
              className="shrink-0 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-red-200 dark:hover:bg-red-900/60"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation modal */}
      {confirmId && userToDelete && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[999] p-4"
          onClick={() => !deleting && setConfirmId(null)}
        >
          <div
            className="bg-surface border border-slate-200 dark:border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">
              Удалить пользователя?
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1 font-medium">
              {userToDelete.displayName || userToDelete.telegramName || userToDelete.email || userToDelete.id}
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mb-4">
              Действие необратимо. Пользователь и все его данные в партнёрской программе будут удалены.
            </p>
            {delErr && (
              <p className="text-xs text-red-600 dark:text-red-400 mb-3">{delErr}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                disabled={deleting}
                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(confirmId)}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {deleting ? 'Удаляем…' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletedIds.size > 0 && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3">
          Удалено пользователей: {deletedIds.size}
        </p>
      )}
    </div>
  )
}
