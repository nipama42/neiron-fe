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
