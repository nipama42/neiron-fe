import { createContext, useContext, useState, type ReactNode } from 'react'

export type ExploreFilterType = 'all' | 'photo' | 'video' | 'new'

interface ExploreFilterState {
  feedFilter: ExploreFilterType
  setFeedFilter: (f: ExploreFilterType) => void
}

const ExploreFilterContext = createContext<ExploreFilterState>({
  feedFilter: 'all',
  setFeedFilter: () => {},
})

export function ExploreFilterProvider({ children }: { children: ReactNode }) {
  const [feedFilter, setFeedFilter] = useState<ExploreFilterType>('all')
  return (
    <ExploreFilterContext.Provider value={{ feedFilter, setFeedFilter }}>
      {children}
    </ExploreFilterContext.Provider>
  )
}

export function useExploreFilter() {
  return useContext(ExploreFilterContext)
}
