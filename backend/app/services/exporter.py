from __future__ import annotations

from app.models.resume import ResumeSchema


def _escape(text: str | None) -> str:
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _render_html(resume: ResumeSchema) -> str:
    m = resume.metadata
    contact_parts = [p for p in [m.email, m.phone, m.location] if p]
    link_parts: list[str] = []
    if m.linkedin:
        link_parts.append(f'<a href="{_escape(m.linkedin)}">{_escape(m.linkedin)}</a>')
    if m.github:
        link_parts.append(f'<a href="{_escape(m.github)}">{_escape(m.github)}</a>')
    if m.website:
        link_parts.append(f'<a href="{_escape(m.website)}">{_escape(m.website)}</a>')

    experience_html = ""
    for exp in resume.experience:
        date_range = exp.start_date
        if exp.end_date:
            date_range += f" – {exp.end_date}"
        else:
            date_range += " – Present"
        bullets = "".join(f"<li>{_escape(b)}</li>" for b in exp.bullets)
        experience_html += f"""
        <div class="entry">
          <div class="entry-header">
            <span class="entry-title">{_escape(exp.title)}</span>
            <span class="entry-date">{_escape(date_range)}</span>
          </div>
          <div class="entry-subtitle">{_escape(exp.company)}{(' · ' + _escape(exp.location)) if exp.location else ''}</div>
          <ul>{bullets}</ul>
        </div>"""

    education_html = ""
    for edu in resume.education:
        date_range = ""
        if edu.start_date and edu.end_date:
            date_range = f"{edu.start_date} – {edu.end_date}"
        elif edu.end_date:
            date_range = edu.end_date
        degree_line = edu.degree
        if edu.field:
            degree_line += f" in {edu.field}"
        gpa_line = f"GPA: {edu.gpa}" if edu.gpa else ""
        education_html += f"""
        <div class="entry">
          <div class="entry-header">
            <span class="entry-title">{_escape(edu.school)}</span>
            <span class="entry-date">{_escape(date_range)}</span>
          </div>
          <div class="entry-subtitle">{_escape(degree_line)}{(' · ' + _escape(gpa_line)) if gpa_line else ''}</div>
          {('<p class="honors">' + _escape(edu.honors) + '</p>') if edu.honors else ''}
        </div>"""

    skills_html = ""
    for skill_group in resume.skills:
        items = ", ".join(_escape(s) for s in skill_group.items)
        skills_html += f"""
        <div class="skill-row">
          <span class="skill-category">{_escape(skill_group.category)}:</span>
          <span class="skill-items">{items}</span>
        </div>"""

    projects_html = ""
    for proj in resume.projects:
        bullets = "".join(f"<li>{_escape(b)}</li>" for b in proj.bullets)
        techs = f'<span class="techs"> · {", ".join(_escape(t) for t in proj.technologies)}</span>' if proj.technologies else ""
        projects_html += f"""
        <div class="entry">
          <div class="entry-header">
            <span class="entry-title">{_escape(proj.name)}{techs}</span>
            {('<a class="proj-url" href="' + _escape(proj.url) + '">' + _escape(proj.url) + '</a>') if proj.url else ''}
          </div>
          {('<p>' + _escape(proj.description) + '</p>') if proj.description else ''}
          <ul>{bullets}</ul>
        </div>"""

    summary_section = ""
    if resume.summary:
        summary_section = f"""
      <section>
        <h2>Summary</h2>
        <p>{_escape(resume.summary)}</p>
      </section>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10pt; color: #1a1a1a; padding: 32px 40px; line-height: 1.4; }}
  h1 {{ font-size: 22pt; font-weight: 700; letter-spacing: -0.5px; }}
  .contact {{ color: #555; font-size: 9pt; margin-top: 4px; }}
  .contact a {{ color: #2563eb; text-decoration: none; }}
  h2 {{ font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 2px; margin: 16px 0 8px; }}
  .entry {{ margin-bottom: 8px; }}
  .entry-header {{ display: flex; justify-content: space-between; align-items: baseline; }}
  .entry-title {{ font-weight: 600; }}
  .entry-date {{ font-size: 9pt; color: #555; white-space: nowrap; }}
  .entry-subtitle {{ color: #444; font-size: 9pt; margin-bottom: 3px; }}
  ul {{ padding-left: 16px; margin-top: 3px; }}
  li {{ margin-bottom: 2px; }}
  .skill-row {{ margin-bottom: 3px; }}
  .skill-category {{ font-weight: 600; }}
  .honors {{ font-style: italic; color: #444; font-size: 9pt; }}
  .techs {{ font-weight: 400; color: #555; font-size: 9pt; }}
  .proj-url {{ font-size: 9pt; color: #2563eb; text-decoration: none; }}
  section {{ margin-bottom: 4px; }}
</style>
</head>
<body>
  <header>
    <h1>{_escape(m.name)}</h1>
    <div class="contact">
      {" · ".join(_escape(p) for p in contact_parts)}
      {(' · ' + ' · '.join(link_parts)) if link_parts else ''}
    </div>
  </header>
  {summary_section}
  {'<section><h2>Experience</h2>' + experience_html + '</section>' if resume.experience else ''}
  {'<section><h2>Education</h2>' + education_html + '</section>' if resume.education else ''}
  {'<section><h2>Projects</h2>' + projects_html + '</section>' if resume.projects else ''}
  {'<section><h2>Skills</h2>' + skills_html + '</section>' if resume.skills else ''}
</body>
</html>"""


def generate_pdf(resume: ResumeSchema) -> bytes:
    from weasyprint import HTML
    html_content = _render_html(resume)
    return HTML(string=html_content).write_pdf()
