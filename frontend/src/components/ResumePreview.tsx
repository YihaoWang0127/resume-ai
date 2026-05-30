import type { EducationItem, ExperienceItem, ResumeSchema, SkillCategory } from '@/types/resume'

interface Props {
  resume: ResumeSchema
  flashSections?: Set<string>
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[8pt] font-bold uppercase tracking-[0.1em] border-b border-gray-700 pb-0.5 mb-2 text-gray-800">
      {children}
    </h2>
  )
}

export default function ResumePreview({ resume, flashSections }: Props) {
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
    <div
      className="bg-white text-gray-900 shadow-md mx-auto font-serif"
      style={{
        width: '100%',
        maxWidth: '816px',
        minHeight: '1056px',
        padding: '48px 56px',
        fontSize: '10.5pt',
        lineHeight: '1.45',
      }}
    >
      {/* Header */}
      <header className={`text-center border-b-[2px] border-gray-800 pb-3 mb-4 ${flash('metadata')}`}>
        <h1
          className="font-bold tracking-tight leading-none"
          style={{ fontSize: '22pt' }}
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
                  <span className="font-bold">{exp.title || <em className="text-gray-400 font-normal">Title</em>}</span>
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
                {g.category && (
                  <span className="font-semibold">{g.category}: </span>
                )}
                {g.items.join(', ')}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
