import { useState } from 'react'

const TERMS_SECTIONS = [
  {
    title: 'Acknowledgment of Roofing Industry Knowledge',
    content: [
      'Client represents that each trainee participating in the Roof MRI training has a basic working knowledge of roofing systems and job site safety procedures.',
    ],
  },
  {
    title: 'Certification, Continuing Education, and Transferability',
    content: [
      'Certification is issued to individual participants only and cannot be transferred to other persons or companies.',
      'A company may represent itself as having \u201cRoof MRI certified staff\u201d only if at least one of its current employees holds an active certification. If a certified employee leaves the company, the company may no longer claim to have certified staff unless others are certified.',
    ],
    subsections: [
      {
        label: '(a) Continuing Education Requirement',
        text: 'Each certified individual must complete a minimum of two (2) continuing training education (CTE) credits per calendar year to maintain active certification status. CTE credit opportunities will be made available by ReDry. Failure to complete the required credits by December 31 of each calendar year will result in suspension of certification until credits are fulfilled.',
      },
      {
        label: '(b) Company Association',
        text: 'Each certified individual\u2019s certification is associated with the company under which they were trained. The individual may only represent themselves as a Roof MRI Certified Technician while employed by or actively contracted with that company.',
      },
      {
        label: '(c) Non-Transferability',
        text: 'Certification does not transfer to a new employer. If a certified individual leaves the company under which they were trained, their certification becomes inactive with respect to any new employer unless both of the following conditions are met: (i) the original certifying company provides explicit written permission authorizing the transfer, and (ii) the new employer is also a certified Roof MRI contractor in good standing. Without both conditions satisfied, the new employer must complete its own certification engagement to utilize Roof MRI services.',
      },
    ],
  },
  {
    title: 'Training Requirements and Equipment',
    subsections: [
      {
        label: '(a) Pre-Field Training Roof List',
        text: 'No later than three (3) business days prior to field training, Client must provide a list of commercial flat or low-slope roofs for use in training. No shingle, metal, or steep-slope roofs will be accepted. Client is responsible for securing roof access and ensuring the roofs are safe for training. Failure to provide the roof list on time may result in cancellation or rescheduling of training.',
      },
      {
        label: '(b) Equipment',
        text: 'Each trainee must bring a qualifying moisture detection device. ReDry will provide equipment specifications beforehand. Limited loaner devices may be available but are not guaranteed. Any borrowed equipment must be returned in original condition or will be billed to Client.',
      },
    ],
  },
  {
    title: 'Payment, Cancellation, and Rescheduling',
    subsections: [
      {
        label: '(a) Professional Tier Payment',
        text: 'Professional packages require payment in full at the time of booking. Training will not be scheduled until full payment has been received.',
      },
      {
        label: '(b) Regional Tier Payment',
        text: 'Regional packages require a non-refundable deposit of fifty percent (50%) of the total package price at the time of booking. The remaining balance is due no later than five (5) business days prior to the scheduled training date.',
      },
      {
        label: '(c) Enterprise Tier Payment',
        text: 'Enterprise engagements are scoped and priced through a consultative process. Enterprise pricing is not finalized through the online configurator. A custom statement of work will be issued following consultation, and payment terms will be defined therein.',
      },
      {
        label: '(d) Non-Performance for Non-Payment',
        text: 'Training will not commence until all outstanding balances have been received in full. ReDry reserves the right to postpone or cancel any scheduled training for which payment has not been received by the required due date, without liability to Client.',
      },
      {
        label: '(e) Client Cancellation',
        text: 'All deposits are non-refundable. If Client cancels for any reason after the deposit has been paid, no portion of the deposit or any payments made shall be returned.',
      },
      {
        label: '(f) Client Rescheduling (Non-Weather)',
        text: 'Client may reschedule training one (1) time without forfeiting their deposit, provided that (i) written notice is given at least seven (7) business days prior to the scheduled training date, and (ii) a $500 rescheduling fee is paid prior to confirming the new date. Any additional reschedule requests shall be treated as a cancellation.',
      },
      {
        label: '(g) Weather-Related Rescheduling',
        text: 'If field training cannot proceed due to weather conditions, Client may reschedule at no additional cost provided written notice is given at least forty-eight (48) hours prior to the scheduled start of training (8:00 AM local time on the first training day). Weather-related reschedules do not count toward the one-time reschedule allowance described in subsection (f).',
      },
      {
        label: '(h) ReDry Rescheduling',
        text: 'ReDry reserves the right to reschedule training at any time due to trainer illness, travel disruption, safety concerns, or other operational reasons, at no cost or penalty to Client. ReDry will make reasonable efforts to provide advance notice and to reschedule within thirty (30) days of the original date.',
      },
    ],
  },
  {
    title: 'Unlimited MRI Package Subscription',
    content: [
      'Access to the full suite of scanning grids and MRI tools requires an active \u201cUnlimited MRI Package\u201d subscription.',
      'If Client opts not to maintain the subscription, they must acknowledge limited access and scanning ability.',
      'A 30-day complimentary trial is available for new trainees.',
    ],
  },
  {
    title: 'Safety Requirements and Liability Waiver',
    subsections: [
      {
        label: '(a) Liability Waiver',
        text: 'All participants must sign a waiver acknowledging the risks of rooftop training, including potential injury or death. ReDry is not liable for accidents or injuries except in cases of gross negligence.',
      },
      {
        label: '(b) Participant Fitness and Conduct',
        text: 'Participants confirm they are medically fit for rooftop activity. Trainers may exclude any individual who appears unfit or unsafe to participate.',
      },
      {
        label: '(c) Required Personal Protective Equipment (PPE)',
        text: 'Participants must wear appropriate PPE, including non-slip footwear. Fall protection gear must be used where required by OSHA, local law, or trainer instruction.',
      },
      {
        label: '(d) On-Site Safety Procedures',
        text: 'Client must provide a safe roof access method. ReDry may delay or cancel field activities due to unsafe conditions, including inclement weather.',
      },
      {
        label: '(e) Age Requirement',
        text: 'Participants must be 18 years of age or older.',
      },
    ],
  },
  {
    title: 'Intellectual Property and Confidentiality',
    content: [
      'All training materials, methods, and the Roof MRI process are proprietary and patent-pending.',
      'No reproduction, external teaching, sublicensing, or redistribution is allowed.',
      'Materials must be handled as confidential and may not be recorded or shared without ReDry\u2019s written permission.',
      'Unauthorized use may result in legal action and revocation of certification.',
      'The confidentiality obligations set forth in this Section shall survive the expiration or termination of this Agreement and shall remain in effect indefinitely.',
    ],
    subsections: [
      {
        label: 'Irreparable Harm and Injunctive Relief',
        text: 'Client acknowledges that any breach of this Section would cause irreparable harm to ReDry for which monetary damages alone would be inadequate. In the event of any actual or threatened breach, ReDry shall be entitled to seek immediate injunctive relief, specific performance, and any other equitable remedies available under law, without the necessity of posting bond or proving actual damages.',
      },
      {
        label: 'Presumption of Liability',
        text: 'Client agrees that ReDry\u2019s demonstration of a breach of any obligation under this Section shall constitute sufficient evidence of liability, and Client shall bear the burden of proving that no damages resulted from such breach. Client further agrees that ReDry shall be entitled to pursue all remedies to the fullest extent permitted by applicable law, including recovery of attorneys\u2019 fees, costs, and consequential damages arising from any such breach.',
      },
      {
        label: 'Liquidated Damages',
        text: 'Client acknowledges that the precise amount of damages resulting from a breach of this Section would be difficult or impossible to determine. Accordingly, in the event of a proven breach, Client agrees to pay liquidated damages in an amount equal to three (3) times the total fees paid under this Agreement, in addition to any other remedies available to ReDry. This liquidated damages provision reflects the parties\u2019 reasonable estimate of anticipated harm and shall not be construed as a penalty.',
      },
    ],
  },
  {
    title: 'Liability, Indemnification, and Remedies',
    subsections: [
      {
        label: '(a) Limitation of Liability',
        text: 'To the maximum extent permitted by applicable law, ReDry\u2019s total aggregate liability arising out of or related to this Agreement, whether in contract, tort, or otherwise, shall not exceed the total fees actually paid by Client under this Agreement. In no event shall ReDry be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of revenue, loss of profits, or loss of business opportunity, regardless of whether such damages were foreseeable or whether ReDry was advised of the possibility thereof.',
      },
      {
        label: '(b) Indemnification',
        text: 'Client agrees to indemnify, defend, and hold harmless ReDry LLC, its officers, employees, trainers, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys\u2019 fees) arising out of or related to: (i) the condition, safety, or accessibility of any roofs or job sites provided by Client for training purposes; (ii) the acts, omissions, or negligence of Client\u2019s employees, agents, or trainees during or in connection with training activities; (iii) Client\u2019s misuse, misrepresentation, or unauthorized application of the Roof MRI certification, methodology, or materials; or (iv) any breach of this Agreement by Client.',
      },
    ],
  },
  {
    title: 'General Terms',
    subsections: [
      {
        label: '(a) Governing Law',
        text: 'This Agreement will be governed by the laws of the state in which ReDry is headquartered, without regard to conflicts of law principles.',
      },
      {
        label: '(b) Force Majeure',
        text: 'Neither party shall be liable for any delay or failure to perform its obligations under this Agreement if such delay or failure results from circumstances beyond the party\u2019s reasonable control, including but not limited to: acts of God, natural disasters, severe weather, fire, flood, epidemic or pandemic, government actions or orders, civil unrest, war or terrorism, labor disputes, utility or telecommunications failures, travel disruptions, or trainer illness or medical emergency. The affected party shall provide prompt written notice and shall use reasonable efforts to mitigate the impact and resume performance as soon as practicable. If a force majeure event continues for more than sixty (60) days, either party may terminate this Agreement upon written notice, and Client shall be entitled to a pro-rata refund of fees paid for services not yet rendered, less any non-refundable deposits.',
      },
      {
        label: '(c) Entire Agreement',
        text: 'This document represents the full understanding between the parties and supersedes all prior agreements regarding training.',
      },
      {
        label: '(d) Amendments',
        text: 'This Agreement may be modified only in writing signed by both parties.',
      },
      {
        label: '(e) Survival',
        text: 'Sections 2 (Certification), 7 (Intellectual Property and Confidentiality), and 8 (Liability, Indemnification, and Remedies) shall survive the expiration or termination of this Agreement.',
      },
    ],
  },
  {
    title: 'Acknowledgment and Execution',
    content: [
      'By signing below, the undersigned certifies that they are authorized to enter into this Agreement on behalf of the Client and to enroll the listed individuals in the Roof MRI Certification Training.',
    ],
  },
]

export default function TermsAccordion({ companyName }) {
  const [openItems, setOpenItems] = useState(new Set())

  function toggle(idx) {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <div className="terms-section">
      <div className="section-header">
        <span className="label">Agreement</span>
        <h2>Terms & Conditions</h2>
        <p>Please review each section before signing.</p>
      </div>
      <p className="terms-intro">
        This Training Agreement ({'\u201C'}Agreement{'\u201D'}) is entered into by and between <strong>ReDry LLC</strong> ({'\u201C'}ReDry{'\u201D'}) and <strong>{companyName || 'Client'}</strong> ({'\u201C'}Client{'\u201D'}), effective as of the date signed below ({'\u201C'}Effective Date{'\u201D'}), and governs the participation of the Client and its individual trainees in the Roof MRI Certification Training Program provided by ReDry.
      </p>
      <div className="accordion">
        {TERMS_SECTIONS.map((section, idx) => {
          const isOpen = openItems.has(idx)
          return (
            <div className={`accordion-item ${isOpen ? 'open' : ''}`} key={idx}>
              <button className="accordion-trigger" onClick={() => toggle(idx)}>
                <div className="trigger-left">
                  <span className="section-num">{idx + 1}</span>
                  <span className="section-title">{section.title}</span>
                </div>
                <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className="accordion-content" style={{ maxHeight: isOpen ? '5000px' : '0' }}>
                <div className="accordion-content-inner">
                  {section.content && section.content.map((p, i) => <p key={i}>{p}</p>)}
                  {section.subsections && section.subsections.map((sub, i) => (
                    <div key={i}>
                      <p className="sub-section">{sub.label}</p>
                      <p>{sub.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
