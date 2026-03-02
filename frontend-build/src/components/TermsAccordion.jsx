import { useState } from 'react'

const TERMS_SECTIONS = [
  {
    title: 'Training Program Overview',
    content: `Roof MRI Training & Certification is a comprehensive, hands-on program designed to certify commercial roofing professionals in non-destructive moisture detection using calibrated Tramex equipment and the proprietary PHD Scale methodology. Training is delivered in-person by certified Roof MRI instructors and includes classroom instruction, equipment calibration, field scanning protocols, and data reporting techniques. The specific scope of training (number of trainees, equipment, tracks, and add-ons) is defined in the package summary above.`,
  },
  {
    title: 'Equipment & Technology',
    content: `All Recon Kits included in your package contain professional-grade Tramex moisture detection equipment, calibrated and ready for field use. Equipment remains the property of the purchasing company upon delivery. Roof MRI provides initial calibration and setup during training. Ongoing calibration guidance and support are included as part of post-training support. Equipment warranties are provided directly by the manufacturer (Tramex). Replacement parts and equipment upgrades (where included in your package tier) are subject to availability.`,
  },
  {
    title: 'Certification Requirements',
    content: `To receive Roof MRI Certification, each trainee must: (a) attend the full in-person training session, (b) demonstrate proficiency in equipment operation and the PHD Scale methodology during hands-on exercises, and (c) pass a written assessment covering core scanning principles and reporting standards. Trainees who do not meet certification requirements during the initial training may schedule a follow-up assessment at no additional charge within 90 days. Certification is valid for one year and may be renewed through re-certification (where included) or by completing an online refresher module.`,
  },
  {
    title: 'Payment Terms',
    content: `Full payment is due upon signing this proposal. Payment is processed securely via Stripe. All prices are in US Dollars. This proposal is valid for 30 days from the date of delivery. After 30 days, pricing and availability are subject to change. No training will be scheduled until payment is received in full.`,
  },
  {
    title: 'Scheduling & Travel',
    content: `Training dates will be mutually agreed upon after payment is received. Roof MRI will make reasonable efforts to accommodate your preferred dates. Training is typically scheduled within 4-8 weeks of payment. Standard training is conducted at your company's facility or a mutually agreed location. Travel expenses for Roof MRI instructors (airfare, lodging, ground transportation, and meals) are included in the package price for locations within the continental United States. Locations outside the continental US may incur additional travel fees, which will be quoted separately.`,
  },
  {
    title: 'Intellectual Property',
    content: `All training materials, curriculum, the PHD Scale methodology, reporting templates, and related intellectual property remain the exclusive property of Roof MRI and ReDry LLC. Your company is granted a non-exclusive, non-transferable license to use these materials solely for internal business operations related to moisture scanning services. Materials may not be reproduced, distributed, or used for training purposes outside your organization without prior written consent from Roof MRI.`,
  },
  {
    title: 'Liability & Insurance',
    content: `Roof MRI provides training and certification in moisture detection methodology and equipment operation. Roof MRI does not guarantee specific business outcomes, revenue projections, or scanning results. The ROI estimates provided are for illustrative purposes only. Each company is responsible for its own professional liability insurance, general liability coverage, and compliance with local regulations when offering moisture scanning services. Roof MRI's total liability under this agreement shall not exceed the total amount paid for the training package.`,
  },
  {
    title: 'Confidentiality',
    content: `Both parties agree to keep confidential any proprietary business information shared during the course of this engagement, including but not limited to pricing, client lists, business strategies, and technical methodologies. This obligation survives the termination of this agreement for a period of two (2) years. Standard scanning results and general knowledge gained through training are not considered confidential and may be used freely in the normal course of business.`,
  },
  {
    title: 'Cancellation & Refund Policy',
    content: `Cancellations made more than 30 days before the scheduled training date are eligible for a full refund minus a 10% administrative fee. Cancellations made 15-30 days before training are eligible for a 50% refund or full credit toward a rescheduled session. Cancellations made less than 15 days before training are non-refundable but may be rescheduled once, subject to instructor availability and a $1,500 rescheduling fee. No-shows on the training date are non-refundable. Roof MRI reserves the right to reschedule training due to weather, travel disruptions, or other circumstances beyond reasonable control, at no additional cost to the client.`,
  },
  {
    title: 'Agreement',
    content: `By signing this proposal, you acknowledge that you have read and agree to these terms and conditions. This proposal, together with the package summary above, constitutes the complete agreement between the parties. Any modifications must be made in writing and agreed upon by both parties. This agreement is governed by the laws of the State of Texas. By signing below, the authorized representative confirms they have the authority to enter into this agreement on behalf of their company.`,
  },
]

export default function TermsAccordion() {
  const [openSections, setOpenSections] = useState(new Set())

  function toggleSection(index) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function expandAll() {
    setOpenSections(new Set(TERMS_SECTIONS.map((_, i) => i)))
  }

  return (
    <div className="terms-wrapper">
      <div className="terms-header">
        <p className="section-title">Terms &amp; Conditions</p>
        <button type="button" className="terms-expand-btn" onClick={expandAll}>
          Expand All
        </button>
      </div>

      <div className="terms-list">
        {TERMS_SECTIONS.map((section, i) => {
          const isOpen = openSections.has(i)
          return (
            <div key={i} className={`terms-item ${isOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="terms-item-header"
                onClick={() => toggleSection(i)}
              >
                <span className="terms-item-number">{i + 1}.</span>
                <span className="terms-item-title">{section.title}</span>
                <span className={`terms-chevron ${isOpen ? 'open' : ''}`}>&#9662;</span>
              </button>
              {isOpen && (
                <div className="terms-item-body">
                  <p>{section.content}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
