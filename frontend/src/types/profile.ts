import type { ExperienceItem } from '@/types/resume'

export interface ProfileData {
  user_id: string
  full_name: string
  phone: string
  address: string
  linkedin_url: string
  github_url: string
  portfolio_url: string
  job_title: string
  target_job_title: string
  target_industry: string
  years_of_experience: number
  experience: ExperienceItem[]
  experience_bullets: string[]
  skills_technical: string
  skills_tools: string
  skills_certifications: string
  updated_at: string
}

export type ProfileInput = Omit<ProfileData, 'user_id' | 'updated_at'>

export const DEFAULT_PROFILE: ProfileInput = {
  full_name: '',
  phone: '',
  address: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  job_title: '',
  target_job_title: '',
  target_industry: '',
  years_of_experience: 0,
  experience: [],
  experience_bullets: [],
  skills_technical: '',
  skills_tools: '',
  skills_certifications: '',
}
