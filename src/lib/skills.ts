// Suggestions keep spelling consistent so recruiter search finds everyone
// ("react" and "React.js" would otherwise be different skills).
export const SKILL_SUGGESTIONS = [
  'Java', 'Python', 'JavaScript', 'TypeScript', 'C', 'C++', 'C#', 'Go', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'Rust', 'SQL',
  'React', 'Angular', 'Vue.js', 'Next.js', 'Node.js', 'Express.js', 'HTML', 'CSS', 'Tailwind CSS', 'Redux',
  'Spring Boot', 'Hibernate', 'Django', 'Flask', 'FastAPI', '.NET', 'Laravel',
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Supabase', 'Firebase', 'Oracle',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'CI/CD', 'Git', 'GitHub', 'Linux', 'Terraform',
  'REST APIs', 'GraphQL', 'Microservices', 'System Design', 'Data Structures', 'Algorithms', 'OOP',
  'Machine Learning', 'Deep Learning', 'NLP', 'Generative AI', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Power BI', 'Tableau', 'Excel',
  'React Native', 'Flutter', 'Android', 'iOS',
  'Selenium', 'Manual Testing', 'Automation Testing', 'Postman', 'JIRA',
  'Product Management', 'Figma', 'UI/UX Design', 'Communication', 'Problem Solving',
]

export const POPULAR_SKILLS = ['Java', 'Python', 'JavaScript', 'React', 'Node.js', 'SQL', 'Spring Boot', 'AWS']

export const MAX_SKILLS = 30
const LOOKUP = new Map(SKILL_SUGGESTIONS.map(s => [s.toLowerCase(), s]))

/** Trim, collapse spaces, and use the canonical casing when we know the skill. */
export function normalizeSkill(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ').slice(0, 40)
  return LOOKUP.get(s.toLowerCase()) ?? s
}

/** Adds skills (comma separated input allowed), de-duplicated case-insensitively. */
export function addSkills(current: string[], input: string): string[] {
  const out = [...current]
  const seen = new Set(out.map(s => s.toLowerCase()))
  for (const part of input.split(',')) {
    const s = normalizeSkill(part)
    if (!s || seen.has(s.toLowerCase()) || out.length >= MAX_SKILLS) continue
    seen.add(s.toLowerCase()); out.push(s)
  }
  return out
}
