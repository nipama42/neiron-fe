import { useEffect, useState } from 'react'
import { fetchDisabledModelIds } from '../../../api/models'
import { patchAdminModelActive } from '../../../api/adminModels'
import { useAuth } from '../../../store/authStore'

const _viteApi = import.meta.env.VITE_API_URL
const API_BASE = typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

interface PriceTier {
  qualityKey?: string
  tierKey?: string
  label: string
  coins: number
}

interface PriceModel {
  id: string
  label: string
  tiers: PriceTier[]
}

const s = {
  card: { background: '#fff', borderRadius: 12, padding: 12, marginTop: 8 } as React.CSSProperties,
}

export default function PricesTab() {
  const { token } = useAuth()
  const [photoModels, setPhotoModels] = useState<PriceModel[]>([])
  const [videoModels, setVideoModels] = useState<PriceModel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  /** id с is_active=false — скрыты на странице «Создать» */
  const [hiddenFromCreateIds, setHiddenFromCreateIds] = useState<Set<string>>(() => new Set())
  const [hideBusyId, setHideBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setPhotoModels([])
      setVideoModels([])
      setErr('Нет токена авторизации')
      setLoading(false)
      return
    }

    setLoading(true)
    setErr(null)
    Promise.all([
      fetch(`${API_BASE}/admin/kie-photo-prices`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (!r.ok) throw new Error(`Ошибка ${r.status}`)
        return r.json() as Promise<{ models: PriceModel[] }>
      }),
      fetch(`${API_BASE}/admin/kie-video-prices`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => {
          if (!r.ok) throw new Error(`Ошибка ${r.status}`)
          return r.json() as Promise<{ models: PriceModel[] }>
        })
        .catch(() => ({ models: [] as PriceModel[] })),
      fetchDisabledModelIds().catch(() => [] as string[]),
    ])
      .then(([photo, video, disabled]) => {
        setPhotoModels(Array.isArray(photo.models) ? photo.models : [])
        setVideoModels(Array.isArray(video.models) ? video.models : [])
        setHiddenFromCreateIds(new Set(disabled))
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false))
  }, [token])

  function updateCoins(kind: 'photo' | 'video', modelId: string, key: string, raw: string) {
    const coins = Math.max(0, Math.min(999999, Math.round(Number(raw) || 0)))
    const updater = (arr: PriceModel[]) =>
      arr.map((m) =>
        m.id !== modelId
          ? m
          : {
            ...m,
            tiers: m.tiers.map((t) =>
              (kind === 'photo' ? t.qualityKey : t.tierKey) === key ? { ...t, coins } : t
            ),
          }
      )
    if (kind === 'photo') setPhotoModels((prev) => updater(prev))
    else setVideoModels((prev) => updater(prev))
  }

  async function saveAll() {
    if (!token) return
    setErr(null)
    setMsg(null)
    setSaving(true)
    try {
      const photoItems = photoModels.flatMap((m) =>
        m.tiers.map((t) => ({ modelId: m.id, qualityKey: String(t.qualityKey ?? ''), coins: t.coins }))
      )
      const videoItems = videoModels.flatMap((m) =>
        m.tiers.map((t) => ({ modelId: m.id, tierKey: String(t.tierKey ?? ''), coins: t.coins }))
      )
      const [photoR, videoR] = await Promise.all([
        fetch(`${API_BASE}/admin/kie-photo-prices`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: photoItems }),
        }),
        fetch(`${API_BASE}/admin/kie-video-prices`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: videoItems }),
        }),
      ])
      if (!photoR.ok || !videoR.ok) throw new Error('Не удалось сохранить цены')
      setMsg('Цены сохранены')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleHiddenFromCreate(modelId: string, hideChecked: boolean) {
    if (!token) return
    setHideBusyId(modelId)
    setErr(null)
    try {
      await patchAdminModelActive(token, modelId, !hideChecked)
      setHiddenFromCreateIds((prev) => {
        const next = new Set(prev)
        if (hideChecked) next.add(modelId)
        else next.delete(modelId)
        return next
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить видимость')
    } finally {
      setHideBusyId(null)
    }
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div style={s.card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 6 }}>Цены моделей</div>
        <p style={{ fontSize: 10, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.35 }}>
          У каждой модели: <strong>✕ скрыть</strong> — не показывать в выборе на «Создать»; снимите — снова в списке и в работе.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', color: '#9ca3af', fontWeight: 500, paddingBottom: 4 }}>Модель / Уровень</th>
              <th style={{ textAlign: 'right', color: '#9ca3af', fontWeight: 500, paddingBottom: 4 }}>Монеты</th>
            </tr>
          </thead>
        </table>
      </div>

      {err && (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12 }}>
          {err}
        </div>
      )}
      {msg && (
        <div style={{ background: '#dcfce7', color: '#166534', borderRadius: 8, padding: '8px 12px', marginTop: 8, fontSize: 12 }}>
          {msg}
        </div>
      )}
      {loading && <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 24 }}>Загрузка...</p>}

      {[{ title: 'Kie Фото', kind: 'photo' as const, models: photoModels }, { title: 'Kie Видео', kind: 'video' as const, models: videoModels }].map((group) => (
        <div key={group.kind}>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 12, marginBottom: 6 }}>{group.title}</div>
          {group.models.map((m) => {
        const isOpen = openIds.has(m.id)
        return (
          <div key={m.id} style={s.card}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => toggle(m.id)}
            >
              <span style={{ fontSize: 12, fontWeight: 500, color: '#111', flex: 1, minWidth: 0 }}>{m.label}</span>
              <div
                role="presentation"
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10,
                    color: '#6b7280',
                    cursor: hideBusyId === m.id ? 'wait' : 'pointer',
                    userSelect: 'none',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '4px 8px',
                    background: hiddenFromCreateIds.has(m.id) ? '#fef2f2' : '#f9fafb',
                  }}
                  title="Скрыть модель из списка на странице «Создать»"
                >
                  <input
                    type="checkbox"
                    checked={hiddenFromCreateIds.has(m.id)}
                    disabled={hideBusyId === m.id}
                    onChange={(e) => void toggleHiddenFromCreate(m.id, e.target.checked)}
                  />
                  <span aria-hidden style={{ fontWeight: 700, color: '#b91c1c' }}>
                    ✕
                  </span>
                  <span>скрыть</span>
                </label>
              </div>
              <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>{isOpen ? 'свернуть ↑' : 'развернуть ↓'}</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                {m.tiers.length === 0 ? (
                  <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', margin: '8px 0' }}>Нет данных</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', color: '#9ca3af', fontWeight: 500, paddingBottom: 4 }}>Уровень</th>
                        <th style={{ textAlign: 'right', color: '#9ca3af', fontWeight: 500, paddingBottom: 4 }}>Монеты</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.tiers.map((t) => {
                        const key = group.kind === 'photo' ? String(t.qualityKey ?? '') : String(t.tierKey ?? '')
                        return (
                        <tr key={key}>
                          <td style={{ padding: '3px 0', color: '#111' }}>{t.label} <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>({key})</span></td>
                          <td style={{ padding: '3px 0', color: '#111', textAlign: 'right', fontWeight: 600 }}>
                            <input
                              type="number"
                              min={0}
                              max={999999}
                              value={t.coins}
                              onChange={(e) => updateCoins(group.kind, m.id, key, e.target.value)}
                              style={{ width: 84, textAlign: 'right', border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 6px' }}
                            />
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
        </div>
      ))}

      {!loading && photoModels.length === 0 && videoModels.length === 0 && !err && (
        <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 24 }}>Нет данных о ценах</p>
      )}
      {!loading && (photoModels.length > 0 || videoModels.length > 0) && (
        <button
          type="button"
          onClick={() => void saveAll()}
          disabled={saving}
          style={{ marginTop: 12, width: '100%', border: 0, borderRadius: 10, padding: '10px 12px', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Сохраняем…' : 'Сохранить цены'}
        </button>
      )}
    </div>
  )
}
