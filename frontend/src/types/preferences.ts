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
  updated_at: string
}

export type UserPreferencesInput = Omit<UserPreferences, 'user_id' | 'updated_at'>

export const DEFAULT_PREFERENCES: UserPreferencesInput = {
  tone: 'professional',
  writing_style: 'concise',
  industry: '',
  job_level: 'mid',
  ats_mode: false,
}
