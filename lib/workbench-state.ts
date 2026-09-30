export type PanelInput = {
  selectedStyleId: string
  resultStyleId: string | null
  hasResult: boolean
  loading: boolean
}

export type PanelView = {
  labelKind: 'selected' | 'result'
  labelStyleId: string
  showGenerate: boolean
  showRegenerate: boolean
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function scrollBehaviorFor(reduced: boolean): 'auto' | 'smooth' {
  return reduced ? 'auto' : 'smooth'
}

export function resultPanel(i: PanelInput): PanelView {
  if (!i.hasResult) {
    return { labelKind: 'selected', labelStyleId: i.selectedStyleId, showGenerate: true, showRegenerate: false }
  }
  const own = i.resultStyleId ?? i.selectedStyleId
  return {
    labelKind: 'result',
    labelStyleId: own,
    showGenerate: false,
    showRegenerate: own !== i.selectedStyleId && !i.loading,
  }
}
