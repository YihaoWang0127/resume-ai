from __future__ import annotations

from app.models.resume import ResumeSchema

_PRESETS: dict[str, dict[str, str]] = {
    "tech": {
        "font": '"Arial", sans-serif',
        "font_name": "Arial",
        "accent": "#2563eb",
        "h1_size": "22pt",
    },
    "finance": {
        "font": '"Georgia", serif',
        "font_name": "Georgia",
        "accent": "#1e3a5f",
        "h1_size": "22pt",
    },
    "creative": {
        "font": '"Helvetica Neue", Helvetica, sans-serif',
        "font_name": "Helvetica Neue",
        "accent": "#7c3aed",
        "h1_size": "26pt",
    },
    "healthcare": {
        "font": '"Times New Roman", Times, serif',
        "font_name": "Times New Roman",
        "accent": "#065f46",
        "h1_size": "20pt",
    },
    "general": {
        "font": '"Helvetica", Arial, sans-serif',
        "font_name": "Helvetica",
        "accent": "#374151",
        "h1_size": "22pt",
    },
}


def _escape(text: str | None) -> str:
    if not text:
        return ""
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _render_html(resume: ResumeSchema, industry: str = "general") -> str:
    p = _PRESETS.get(industry, _PRESETS["general"])
    font = p["font"]
    accent = p["accent"]
    h1_size = p["h1_size"]
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
  body {{ font-family: {font}; font-size: 10pt; color: #1a1a1a; padding: 32px 40px; line-height: 1.4; }}
  h1 {{ font-size: {h1_size}; font-weight: 700; letter-spacing: -0.5px; }}
  .contact {{ color: #555; font-size: 9pt; margin-top: 4px; }}
  .contact a {{ color: {accent}; text-decoration: none; }}
  h2 {{ font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1.5px solid {accent}; color: {accent}; padding-bottom: 2px; margin: 16px 0 8px; }}
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
  .proj-url {{ font-size: 9pt; color: {accent}; text-decoration: none; }}
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


def generate_pdf(resume: ResumeSchema, industry: str = "general") -> bytes:
    from weasyprint import HTML
    html_content = _render_html(resume, industry)
    return HTML(string=html_content).write_pdf()


def generate_docx(resume: ResumeSchema, industry: str = "general") -> bytes:
    from io import BytesIO
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    preset = _PRESETS.get(industry, _PRESETS["general"])
    font_name = preset["font_name"]
    accent_hex = preset["accent"].lstrip("#")
    accent_rgb = RGBColor(int(accent_hex[0:2], 16), int(accent_hex[2:4], 16), int(accent_hex[4:6], 16))

    doc = Document()

    for section in doc.sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Remove the default empty paragraph Word adds
    for p in doc.paragraphs:
        p._element.getparent().remove(p._element)

    m = resume.metadata

    # Name
    name_p = doc.add_paragraph()
    name_run = name_p.add_run(m.name or "")
    name_run.bold = True
    name_run.font.size = Pt(20)
    name_run.font.name = font_name

    # Contact line
    contact_parts = [p for p in [m.email, m.phone, m.location, m.linkedin, m.github] if p]
    if contact_parts:
        cp = doc.add_paragraph(" · ".join(contact_parts))
        cp.runs[0].font.size = Pt(9)
        cp.runs[0].font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    def _heading(title: str) -> None:
        p = doc.add_paragraph()
        run = p.add_run(title.upper())
        run.bold = True
        run.font.size = Pt(10)
        run.font.name = font_name
        run.font.color.rgb = accent_rgb
        pPr = p._p.get_or_add_pPr()
        pBdr = OxmlElement("w:pBdr")
        bottom = OxmlElement("w:bottom")
        bottom.set(qn("w:val"), "single")
        bottom.set(qn("w:sz"), "6")
        bottom.set(qn("w:space"), "1")
        bottom.set(qn("w:color"), accent_hex)
        pBdr.append(bottom)
        pPr.append(pBdr)

    if resume.summary:
        _heading("Summary")
        doc.add_paragraph(resume.summary)

    if resume.experience:
        _heading("Experience")
        for exp in resume.experience:
            date_range = exp.start_date + (f" – {exp.end_date}" if exp.end_date else " – Present")
            p = doc.add_paragraph()
            r1 = p.add_run(exp.title)
            r1.bold = True
            r2 = p.add_run(f"  {date_range}")
            r2.font.size = Pt(9)
            r2.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
            company_line = exp.company + (f" · {exp.location}" if exp.location else "")
            cp = doc.add_paragraph(company_line)
            cp.runs[0].font.size = Pt(9)
            cp.runs[0].font.color.rgb = RGBColor(0x44, 0x44, 0x44)
            for bullet in exp.bullets:
                if bullet.strip():
                    doc.add_paragraph(bullet, style="List Bullet")

    if resume.education:
        _heading("Education")
        for edu in resume.education:
            if edu.start_date and edu.end_date:
                date_range = f"{edu.start_date} – {edu.end_date}"
            elif edu.end_date:
                date_range = edu.end_date
            else:
                date_range = ""
            p = doc.add_paragraph()
            p.add_run(edu.school).bold = True
            if date_range:
                dr = p.add_run(f"  {date_range}")
                dr.font.size = Pt(9)
                dr.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
            degree_line = edu.degree + (f" in {edu.field}" if edu.field else "")
            if edu.gpa:
                degree_line += f" · GPA: {edu.gpa}"
            if degree_line:
                dp = doc.add_paragraph(degree_line)
                dp.runs[0].font.size = Pt(9)

    if resume.skills:
        _heading("Skills")
        for sg in resume.skills:
            p = doc.add_paragraph()
            p.add_run(f"{sg.category}: ").bold = True
            p.add_run(", ".join(sg.items))

    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()
