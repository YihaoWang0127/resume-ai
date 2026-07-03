export type Tone = 'professional' | 'conversational' | 'executive'
export type WritingStyle = 'concise' | 'detailed' | 'keyword-optimized'
export type JobLevel = 'junior' | 'mid' | 'senior' | 'executive'

export interface UserPreferences {
  user_id: string
  tone: Tone
  writing_style: WritingStyle
  industry: string
  job_level: JobLevel
  ats_mode: boolean
  notify_export_complete: boolean
  notify_product_updates: boolean
  default_model?: string
  updated_at: string
}

export type UserPreferencesInput = Omit<UserPreferences, 'user_id' | 'updated_at'>

export const DEFAULT_PREFERENCES: UserPreferencesInput = {
  tone: 'professional',
  writing_style: 'concise',
  industry: '',
  job_level: 'mid',
  ats_mode: false,
  notify_export_complete: true,
  notify_product_updates: false,
  default_model: 'claude-sonnet-4-6',
}
