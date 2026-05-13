import { useCallback, useEffect, useState, type SetStateAction } from 'react'

const KEY = 'neiro-admin-support-selected-user-id'

function readStored(): string | null {
  try {
    const s = sessionStorage.getItem(KEY)?.trim()
    return s || null
  } catch {
    return null
  }
}

function writeStored(id: string | null) {
  try {
    if (id) sessionStorage.setItem(KEY, id)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* private mode / quota */
  }
}

/** Выбранный чат поддержки в админке: переживает переключение вёрстки и обновление страницы. */
export function useAdminSupportThreadSelection() {
  const [selectedId, setSelectedIdState] = useState<string | null>(readStored)

  useEffect(() => {
    writeStored(selectedId)
  }, [selectedId])

  const setSelectedId = useCallback((value: SetStateAction<string | null>) => {
    setSelectedIdState(value)
  }, [])

  return [selectedId, setSelectedId] as const
}
