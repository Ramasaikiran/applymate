import LegalPage, { H2, H3, P, Ul } from '../components/LegalPage'

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund and Cancellation Policy" effectiveDate="July 4, 2026">
      <P>ApplyMate, operated by Rama Sai Kiran Medam ("we," "us," "our").</P>
      <P>By purchasing any paid plan, you agree to this Policy along with our Terms and Privacy Policy.</P>

      <H2>1. Overview</H2>
      <P>ApplyMate is a subscription job application platform for job seekers in India.</P>
      <Ul>
        <li><strong>Basic (₹399/month):</strong> You apply. We surface a daily matched job feed.</li>
        <li><strong>Pro (₹1,999/month):</strong> Our team applies for you, official career portals only.</li>
        <li><strong>Max Pro (₹3,599/month):</strong> Everything in Pro, plus resume rewrite and interview support.</li>
      </Ul>
      <P>All payments are processed via Razorpay. We never store your card or bank details.</P>

      <H2>2. Subscription and Billing</H2>
      <Ul>
        <li>Prices may change. Existing subscribers are notified before any increase.</li>
        <li>Payment is collected upfront for a 30-day cycle.</li>
        <li>All prices are in Indian Rupees (INR).</li>
      </Ul>

      <H2>3. Refund Policy</H2>
      <H3>A. Withdrawal Mid-Plan</H3>
      <P>Refund = (Amount Paid ÷ 30) × Remaining Days − Razorpay's 2% fee.</P>
      <P>Days used are billed and non-refundable. Razorpay's 2% fee is never refundable.</P>
      <P>Example: ₹399 plan, 15 days used → ₹199.50 refundable, minus ₹7.98 fee → ₹191.52 refunded.</P>

      <H3>B. Landed a Job Before Plan Ends</H3>
      <P>We don't refund remaining days. We keep applying for a better offer instead.</P>
      <P>Prefer to stop? Treated as a standard withdrawal under Section 3A.</P>

      <H3>C. Before Any Work Begins</H3>
      <P>Full refund minus Razorpay's 2% fee, if we haven't screened a single job yet.</P>

      <H3>D. Technical or Billing Errors</H3>
      <P>Full refunds for verified duplicate charges or unauthorized transactions.</P>

      <H2>4. Refund Processing</H2>
      <P>Refunds go to your original payment method via Razorpay. Takes 5–7 business days.</P>

      <H2>5. How to Request a Refund</H2>
      <P>Email support@applymate.in with your registered email and reason. Requests must be within 30 days of charge.</P>

      <H2>6. Cancellation</H2>
      <P>Cancel anytime from your dashboard. No lock-in period. Access continues until cycle ends.</P>

      <H2>7. No Guarantee of Results</H2>
      <P>We don't guarantee interviews or offers. Outcomes depend on factors beyond our control.</P>
    </LegalPage>
  )
}
