export interface Metadata {
  fullName: string
  email: string
  phone?: string
  location?: string
  linkedIn?: string
  github?: string
}

export interface ExperienceItem {
  company: string
  title: string
  startDate: string
  endDate?: string
  current: boolean
  bullets: string[]
}

export interface EducationItem {
  institution: string
  degree: string
  field: string
  graduationYear: string
}

export interface SkillCategory {
  category: string
  items: string[]
}

export interface ResumeSchema {
  metadata: Metadata
  summary?: string
  experience: ExperienceItem[]
  education: EducationItem[]
  skills: SkillCategory[]
  detectedIndustry?: string
}

export interface ATSScoreResult {
  overallScore: number
  matchedKeywords: string[]
  missingKeywords: string[]
  suggestions: string[]
  summary: string
}
