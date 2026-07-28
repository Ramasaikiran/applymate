import LegalPage, { H2, P, Ul } from '../components/LegalPage'

export default function Terms() {
  return (
    <LegalPage title="Terms and Conditions" effectiveDate="July 4, 2026">
      <P>ApplyMate, operated by Rama Sai Kiran Medam ("we," "our," "us").</P>
      <P>By using ApplyMate, you agree to these Terms, our Privacy Policy, and Refund Policy.</P>

      <H2>1. Overview of Service</H2>
      <P>We help job seekers in India apply to relevant jobs faster.</P>
      <Ul>
        <li><strong>Basic:</strong> Daily job feed matched to your skills. You apply yourself.</li>
        <li><strong>Pro:</strong> We apply for you, official career portals only. No bots.</li>
        <li><strong>Max Pro:</strong> Everything in Pro, plus resume rewrite and interview support.</li>
      </Ul>
      <P>We apply only when a job matches you on three metrics: industry, skills, experience.</P>
      <P>If we skip a job, your dashboard shows exactly which metric was missing.</P>
      <P>We don't guarantee interviews, callbacks, or offers.</P>

      <H2>2. Eligibility</H2>
      <P>You must be 18 or older to use this Service.</P>

      <H2>3. Account Registration</H2>
      <P>Provide accurate info. Keep credentials confidential. No fake or duplicate accounts.</P>

      <H2>4. How We Apply On Your Behalf</H2>
      <Ul>
        <li>Applications go only through official career portals. Never bots or bulk-apply tools.</li>
        <li>We never ask for your job portal or email passwords.</li>
        <li>Keep your resume and preferences updated for accurate matching.</li>
      </Ul>

      <H2>5. User Responsibilities</H2>
      <Ul>
        <li>Keep your profile and resume accurate.</li>
        <li>Check your dashboard for application status.</li>
        <li>Respond to any verification requests.</li>
      </Ul>

      <H2>6. Subscription, Billing, Cancellation</H2>
      <P>Billed monthly, in advance, in INR, via PayU. Cancel anytime, no lock-in.</P>
      <P>Refunds are governed entirely by our Refund and Cancellation Policy.</P>

      <H2>7. Match Transparency</H2>
      <P>Every screened job is logged. Applied jobs and skipped jobs both show in your dashboard.</P>

      <H2>8. Data Storage and Security</H2>
      <P>Your data is stored securely with encryption. No system is 100% secure.</P>

      <H2>9. User Content and Ownership</H2>
      <P>You own your resume and profile data. Request deletion anytime by emailing us.</P>

      <H2>10. Acceptable Use</H2>
      <Ul>
        <li>No false or misleading profile information.</li>
        <li>No fake or duplicate accounts.</li>
        <li>No interference with platform security.</li>
      </Ul>

      <H2>11. Intellectual Property</H2>
      <P>All platform content and code belong to us. No copying or reverse-engineering.</P>

      <H2>12. Termination</H2>
      <P>We may suspend accounts violating these Terms. Refunds follow our Refund Policy.</P>

      <H2>13. Limitation of Liability</H2>
      <P>We're not liable for indirect damages, including missed job opportunities.</P>

      <H2>14. Governing Law</H2>
      <P>Governed by Indian law. Disputes subject to Hyderabad, Telangana courts.</P>
    </LegalPage>
  )
}
