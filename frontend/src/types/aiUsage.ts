export type AiUsageAction = 'parse' | 'enrich' | 'tailor' | 'cover_letter' | 'cover_letter_improve' | 'ats_score'

export interface AiUsageEntry {
  id: string
  action: AiUsageAction
  model: string
  created_at: string
}

export interface AiUsageStats {
  totalCalls: number
  callsThisMonth: number
  callsByAction: Record<AiUsageAction, number>
  recent: AiUsageEntry[]
}
