import { cn } from '@/lib/utils'
import type { EducationItem, ExperienceItem, ResumeSchema, SkillCategory } from '@/types/resume'

interface Props {
  resume: ResumeSchema
  flashSections?: Set<string>
  industry?: string
  detectedIndustry?: string
  onIndustryChange?: (id: string) => void
}

const PRESETS: Record<string, { font: string; accent: string; h1Size: string }> = {
  tech:       { font: 'Arial, sans-serif',                       accent: '#2563eb', h1Size: '22pt' },
  finance:    { font: 'Georgia, serif',                          accent: '#1e3a5f', h1Size: '22pt' },
  creative:   { font: '"Helvetica Neue", Helvetica, sans-serif', accent: '#7c3aed', h1Size: '26pt' },
  healthcare: { font: '"Times New Roman", Times, serif',         accent: '#065f46', h1Size: '20pt' },
  general:    { font: 'Helvetica, Arial, sans-serif',            accent: '#374151', h1Size: '22pt' },
}

const STYLE_OPTIONS = [
  { id: 'tech',       label: 'Tech'       },
  { id: 'finance',    label: 'Finance'    },
  { id: 'creative',   label: 'Creative'   },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'general',    label: 'General'    },
]

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[8pt] font-bold uppercase tracking-[0.1em] pb-0.5 mb-2"
      style={{ color: 'var(--accent)', borderBottom: '1.5px solid var(--accent)' }}
    >
      {children}
    </h2>
  )
}

export default function ResumePreview({
  resume,
  flashSections,
  industry = 'general',
  detectedIndustry,
  onIndustryChange,
}: Props) {
  const preset = PRESETS[industry] ?? PRESETS.general

  const flash = (key: string) =>
    flashSections?.has(key)
      ? 'transition-colors duration-500 rounded px-2 -mx-2 py-1 -my-1 bg-green-50 ring-1 ring-green-300'
      : 'transition-colors duration-500'

  const { metadata, summary, experience, education, skills } = resume
  const contacts = [
    metadata.email,
    metadata.phone,
    metadata.location,
    metadata.linkedIn,
    metadata.github,
  ].filter(Boolean)

  return (
    <div>
      {/* Style switcher */}
      {onIndustryChange && (
        <div className="flex items-center gap-2 mb-3 flex-wrap lg:flex-nowrap overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest shrink-0">Style:</span>
          {STYLE_OPTIONS.map((opt) => {
            const isActive = industry === opt.id
            const isDetected = detectedIndustry === opt.id
            return (
              <div key={opt.id} className="flex items-center gap-1">
                <button
                  onClick={() => onIndustryChange(opt.id)}
                  className={cn(
                    'text-xs px-2.5 py-0.5 font-bold uppercase tracking-wider border transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-primary border-primary hover:bg-primary/10',
                  )}
                >
                  {opt.label}
                </button>
                {isDetected && (
                  <span className="text-[10px] text-primary font-bold whitespace-nowrap uppercase">
                    ✓ AI
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Resume card */}
      <div
        className="bg-white text-gray-900 shadow-md mx-auto"
        style={{
          '--accent': preset.accent,
          width: '100%',
          maxWidth: '816px',
          minHeight: '1056px',
          padding: '48px 56px',
          fontSize: '10.5pt',
          lineHeight: '1.45',
          fontFamily: preset.font,
        } as React.CSSProperties}
      >
        {/* Header */}
        <header
          className={`text-center pb-3 mb-4 ${flash('metadata')}`}
          style={{ borderBottom: `2px solid ${preset.accent}` }}
        >
          <h1
            className="font-bold tracking-tight leading-none"
            style={{ fontSize: preset.h1Size, color: preset.accent }}
          >
            {metadata.fullName || <span className="text-gray-400">Your Name</span>}
          </h1>
          {contacts.length > 0 && (
            <p className="text-gray-600 mt-1.5" style={{ fontSize: '9pt' }}>
              {contacts.join('  ·  ')}
            </p>
          )}
        </header>

        {/* Summary */}
        {summary && (
          <section className={`mb-4 ${flash('summary')}`}>
            <SectionHeading>Summary</SectionHeading>
            <p style={{ fontSize: '10pt' }}>{summary}</p>
          </section>
        )}

        {/* Experience */}
        {experience.length > 0 && (
          <section className={`mb-4 ${flash('experience')}`}>
            <SectionHeading>Experience</SectionHeading>
            <div className="space-y-3">
              {experience.map((exp: ExperienceItem, i: number) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold">
                      {exp.title || <em className="text-gray-400 font-normal">Title</em>}
                    </span>
                    <span className="text-gray-500 whitespace-nowrap shrink-0" style={{ fontSize: '8.5pt' }}>
                      {exp.startDate} – {exp.current ? 'Present' : (exp.endDate ?? '')}
                    </span>
                  </div>
                  <p className="text-gray-600" style={{ fontSize: '9.5pt' }}>
                    {exp.company}
                  </p>
                  {exp.bullets.filter(Boolean).length > 0 && (
                    <ul className="list-disc list-outside ml-4 mt-1 space-y-0.5">
                      {exp.bullets.filter(Boolean).map((b: string, j: number) => (
                        <li key={j} style={{ fontSize: '10pt' }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {education.length > 0 && (
          <section className={`mb-4 ${flash('education')}`}>
            <SectionHeading>Education</SectionHeading>
            <div className="space-y-2">
              {education.map((edu: EducationItem, i: number) => (
                <div key={i}>
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="font-bold">{edu.institution}</span>
                    <span className="text-gray-500 whitespace-nowrap shrink-0" style={{ fontSize: '8.5pt' }}>
                      {edu.graduationYear}
                    </span>
                  </div>
                  <p style={{ fontSize: '9.5pt' }}>
                    {[edu.degree, edu.field].filter(Boolean).join(' in ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section className={flash('skills')}>
            <SectionHeading>Skills</SectionHeading>
            <div className="space-y-1">
              {skills.map((g: SkillCategory, i: number) => (
                <p key={i} style={{ fontSize: '10pt' }}>
                  {g.category && <span className="font-semibold">{g.category}: </span>}
                  {g.items.join(', ')}
                </p>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
