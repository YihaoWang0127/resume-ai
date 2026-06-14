import type { ExperienceItem } from '@/types/resume'

export interface ProfileData {
  user_id: string
  full_name: string
  phone: string
  address: string
  job_title: string
  experience: ExperienceItem[]
  updated_at: string
}

export type ProfileInput = Omit<ProfileData, 'user_id' | 'updated_at'>

export const DEFAULT_PROFILE: ProfileInput = {
  full_name: '',
  phone: '',
  address: '',
  job_title: '',
  experience: [],
}
