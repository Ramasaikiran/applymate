import LegalPage, { H2, P } from '../components/LegalPage'

export default function About() {
  return (
    <LegalPage title="About Us" effectiveDate="July 28, 2026">
      <P>ApplyMate is operated by Rama Sai Kiran Medam, based in Hyderabad, India.</P>

      <H2>What We Do</H2>
      <P>ApplyMate helps job seekers in India apply to relevant jobs faster.</P>
      <P>We match candidates to jobs on skills, industry, and experience, and apply on their behalf through official career portals only.</P>

      <H2>Our Mission</H2>
      <P>Job hunting is slow and repetitive. We remove the manual work so candidates can focus on interviews, not applications.</P>

      <H2>Contact</H2>
      <P>Reach us anytime — see our Contact page for details.</P>
    </LegalPage>
  )
}
