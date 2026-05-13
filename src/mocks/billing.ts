import type { Plan, TopupPackage } from '../api/billing'

export const mockPlans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    creditsPerDay: 10,
    features: ['10 кредитов в день', 'Все типы контента', 'Community доступ'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 499,
    creditsPerDay: 100,
    features: ['100 кредитов в день', 'Приоритетная очередь', 'Без водяных знаков', 'Community доступ'],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    price: 1490,
    creditsPerDay: 500,
    features: ['500 кредитов в день', 'Максимальный приоритет', 'Без водяных знаков', 'Ранний доступ к моделям'],
  },
]

export const mockTopupPackages: TopupPackage[] = [
  { id: 'pack_50',   credits: 50,   price: 99 },
  { id: 'pack_150',  credits: 150,  price: 249 },
  { id: 'pack_500',  credits: 500,  price: 699,  bonus: 50 },
  { id: 'pack_1500', credits: 1500, price: 1990, bonus: 200 },
]
