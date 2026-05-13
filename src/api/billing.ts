const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export interface Plan {
  id: string
  name: string
  price: number
  creditsPerDay: number
  features: string[]
}

export interface TopupPackage {
  id: string
  credits: number
  price: number
  bonus?: number
}

export async function fetchPlans(token: string): Promise<Plan[]> {
  const res = await fetch(`${API_BASE}/billing/plans`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch plans')
  return res.json()
}

export async function fetchTopupPackages(token: string): Promise<TopupPackage[]> {
  const res = await fetch(`${API_BASE}/billing/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch packages')
  return res.json()
}
