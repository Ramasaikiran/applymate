import LegalPage, { H2, P, Ul } from '../components/LegalPage'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="July 4, 2026">
      <P>ApplyMate, operated by Rama Sai Kiran Medam ("we," "our," "us").</P>
      <P>This Policy explains how we collect, use, and protect your data.</P>

      <H2>1. Information We Collect</H2>
      <Ul>
        <li>Profile data: name, email, phone, skills, role preference, location.</li>
        <li>Resume and application history.</li>
        <li>Payment data via PayU. We never see your full card details.</li>
        <li>Usage data: pages visited, actions taken on the dashboard.</li>
      </Ul>

      <H2>2. How We Use Your Data</H2>
      <Ul>
        <li>Match you to relevant jobs based on skills, industry, experience.</li>
        <li>Apply to jobs on your behalf for Pro and Max Pro plans.</li>
        <li>Send you application updates and renewal reminders.</li>
        <li>Process payments and refunds.</li>
      </Ul>

      <H2>3. Data Sharing</H2>
      <P>We never sell your data. We only share it with:</P>
      <Ul>
        <li>PayU, for payment processing.</li>
        <li>Employers, only when we submit an application on your behalf.</li>
      </Ul>

      <H2>4. Data Storage and Security</H2>
      <P>Your data is stored securely with encryption and access controls. No system is 100% secure.</P>

      <H2>5. Your Rights</H2>
      <Ul>
        <li>Request a copy of your data anytime.</li>
        <li>Request correction of inaccurate data.</li>
        <li>Request account and data deletion. We process this within 2 days.</li>
      </Ul>

      <H2>6. Children's Privacy</H2>
      <P>Our Service is for users 18 and older. We don't knowingly collect data from minors.</P>

      <H2>7. Changes to This Policy</H2>
      <P>We may update this Policy. Material changes will be notified to you.</P>

      <H2>8. Contact</H2>
      <P>Rama Sai Kiran Medam<br />support@applymate.in</P>
    </LegalPage>
  )
}
