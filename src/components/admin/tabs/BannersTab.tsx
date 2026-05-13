import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../store/authStore'
import {
  deleteAdminBanner,
  getAdminBanners,
  uploadAdminBanner,
  type BannerItem,
} from '../../../api/admin'

const SLOTS = [1, 2, 3] as const

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function BannersTab() {
  const { token } = useAuth()
  const [banners, setBanners] = useState<Record<number, BannerItem>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [err, setErr] = useState<string | null>(null)
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({})

  async function load() {
    try {
      setLoading(true)
      const list = await getAdminBanners()
      const map: Record<number, BannerItem> = {}
      for (const b of list) map[b.slot] = b
      setBanners(map)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function setBusySlot(slot: number, val: boolean) {
    setBusy((prev) => ({ ...prev, [slot]: val }))
  }

  async function handleUpload(slot: number, file: File) {
    if (!token) return
    setErr(null)
    setBusySlot(slot, true)
    try {
      const dataUrl = await fileToDataUrl(file)
      await uploadAdminBanner(token, slot, dataUrl)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setBusySlot(slot, false)
    }
  }

  async function handleDelete(slot: number) {
    if (!token) return
    if (!confirm(`Удалить баннер ${slot}?`)) return
    setErr(null)
    setBusySlot(slot, true)
    try {
      await deleteAdminBanner(token, slot)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка удаления')
    } finally {
      setBusySlot(slot, false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Баннеры главной страницы
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Обновить
        </button>
      </div>

      {err ? (
        <p className="text-xs text-red-600 dark:text-red-400">{err}</p>
      ) : null}

      {loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Загрузка...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SLOTS.map((slot) => {
            const banner = banners[slot]
            const isBusy = Boolean(busy[slot])
            return (
              <div key={slot} className="flex flex-col gap-2">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Баннер {slot}
                </p>

                {/* Preview */}
                <div className="relative h-20 rounded-xl overflow-hidden bg-black">
                  {banner?.imageUrl ? (
                    <img
                      src={banner.imageUrl}
                      alt={`Баннер ${slot}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-white/30">Нет изображения</span>
                    </div>
                  )}
                  {isBusy && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-xs text-white">...</span>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => inputRefs.current[slot]?.click()}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs py-2 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {banner?.imageUrl ? '🔄 Заменить' : '📁 Загрузить'}
                  </button>
                  {banner?.imageUrl ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleDelete(slot)}
                      className="rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs px-3 py-2 font-medium hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                    >
                      ✕
                    </button>
                  ) : null}
                </div>

                <input
                  ref={(el) => { inputRefs.current[slot] = el }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(slot, file)
                    e.target.value = ''
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        Рекомендуемые пропорции: 16:6 (например 1600×600 px). Форматы: jpg, png, webp.
      </p>
    </div>
  )
}
