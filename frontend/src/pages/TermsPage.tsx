import DocumentLayout from '../components/DocumentLayout'
import { LegalList, LegalSection, LegalToc, type TOCItem } from '../components/legal'

const TOC: TOCItem[] = [
  { id: 'acceptance', n: 1, label: 'Acceptance of Terms' },
  { id: 'using', n: 2, label: 'Using FocusFlow AI' },
  { id: 'accounts', n: 3, label: 'User Accounts' },
  { id: 'study-content', n: 4, label: 'Study Content' },
  { id: 'flox', n: 5, label: 'FLOX AI' },
  { id: 'ai-content', n: 6, label: 'AI-Generated Content' },
  { id: 'quizzes', n: 7, label: 'Quizzes and Study Recommendations' },
  { id: 'prohibited', n: 8, label: 'Prohibited Activities' },
  { id: 'third-party', n: 9, label: 'Third-Party Services' },
  { id: 'availability', n: 10, label: 'Availability & Service Changes' },
  { id: 'termination', n: 11, label: 'Account Suspension or Termination' },
  { id: 'ip', n: 12, label: 'Intellectual Property' },
  { id: 'disclaimer', n: 13, label: 'Disclaimer' },
  { id: 'liability', n: 14, label: 'Limitation of Liability' },
  { id: 'changes', n: 15, label: 'Changes to These Terms' },
  { id: 'contact', n: 16, label: 'Contact' },
]

export default function TermsPage() {
  return (
    <DocumentLayout
      eyebrow="Legal"
      title="Terms of Service"
      subtitle="Please read these terms before using FocusFlow AI."
    >
      <p className="legal-updated">Last updated: September 1, 2026</p>

      <p className="legal-intro">
        These terms govern your use of FocusFlow AI. By creating an account or using the service, you
        agree to be bound by them.
      </p>

      <LegalToc items={TOC} />

      <LegalSection n={1} title="Acceptance of Terms" id="acceptance">
        <p>
          By accessing or using FocusFlow AI, you agree to these Terms of Service and our Privacy
          Policy. If you do not agree, please do not use the service.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Using FocusFlow AI" id="using">
        <p>
          FocusFlow AI is a personal study workspace that helps you plan, focus, learn and track
          progress. You may use it for personal, non-commercial educational purposes only. You are
          responsible for how you use the service and for the accuracy of the information you enter.
        </p>
      </LegalSection>

      <LegalSection n={3} title="User Accounts" id="accounts">
        <LegalList
          items={[
            <>You must provide accurate information when creating an account and keep it up to date.</>,
            <>You are responsible for safeguarding your login credentials and for activity under your account.</>,
            <>Notify us if you suspect unauthorized access to your account.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={4} title="Study Content" id="study-content">
        <p>
          The subjects, tasks, exams, notes, plans and other content you add are yours. You retain all
          rights to the content you upload, and you grant FocusFlow AI a limited license to store and
          process it solely to provide the service to you.
        </p>
      </LegalSection>

      <LegalSection n={5} title="FLOX AI" id="flox">
        <p>
          FLOX AI provides educational assistance. The service includes a fair-use allowance of free
          AI requests per day, and you may sometimes earn bonus requests. We may adjust limits to keep
          the platform working for everyone.
        </p>
        <LegalList
          items={[
            <>You are responsible for the prompts and information you provide to FLOX AI.</>,
            <>Do not use FLOX AI to generate content for cheating, impersonation, or any unlawful purpose, or to create unoriginal submitted work presented as your own where this breaches your institution&apos;s or exam board&apos;s rules.</>,
            <>Abuse or attempts to bypass FLOX AI limits may result in restricted access.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={6} title="AI-Generated Content" id="ai-content">
        <p>
          FLOX AI provides educational assistance and generated content. <strong>AI-generated responses
          may contain errors</strong> and should be reviewed by you. FocusFlow AI does not guarantee
          that AI-generated information is accurate, complete, or suitable for a particular academic
          purpose, and it should not be relied on as the sole basis for academic work or decisions.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Quizzes and Study Recommendations" id="quizzes">
        <p>
          Quizzes, plans and recommendations are generated to support your own studying. They are
          suggestions &mdash; not guarantees of performance on real examinations. You remain responsible
          for verifying material against your syllabus, textbooks and instructors.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Prohibited Activities" id="prohibited">
        <LegalList
          items={[
            <>Using the service for any unlawful purpose.</>,
            <>Attempting to access, disrupt or abuse the service, other users, or our systems.</>,
            <>Reverse engineering, scraping or automated bulk access of the service.</>,
            <>Uploading malware, infringing content, or content that violates someone&apos;s privacy or rights.</>,
            <>Impersonating another person or misrepresenting your affiliation.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={9} title="Third-Party Services" id="third-party">
        <p>
          FocusFlow AI uses third-party services to operate, including Google Gemini for AI features and
          hosting providers. Those providers process data as described in our Privacy Policy. We are not
          responsible for the contents or availability of any third-party websites linked from the app.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Availability & Service Changes" id="availability">
        <p>
          We aim to keep FocusFlow AI available, but the service may be interrupted for maintenance,
          updates or reasons outside our control. We may add, change or remove features over time, and
          we may temporarily limit AI features when platform capacity is reached.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Account Suspension or Termination" id="termination">
        <p>
          You can stop using FocusFlow AI at any time and delete your account (see our Privacy Policy).
          We may suspend or terminate accounts that violate these terms or the law. On termination, you
          lose access to the account; you may request a copy of your data before deletion.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Intellectual Property" id="ip">
        <p>
          FocusFlow AI and its branding, design and software are owned by us or our licensors and are
          protected by intellectual property laws. You may not copy or reuse the app itself, its
          branding, or its proprietary features beyond normal personal use. Your own study content
          remains yours.
        </p>
      </LegalSection>

      <LegalSection n={13} title="Disclaimer" id="disclaimer">
        <p>
          FocusFlow AI is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties
          of any kind, whether express or implied, including fitness for a particular purpose,
          accuracy, availability or non-infringement. We do not guarantee that study plans, AI
          responses or recommendations will improve grades or exam results.
        </p>
      </LegalSection>

      <LegalSection n={14} title="Limitation of Liability" id="liability">
        <p>
          To the maximum extent permitted by law, FocusFlow AI and its operators shall not be liable
          for indirect, incidental, special or consequential damages, or for loss of data, arising from
          your use of the service. Our total liability for any claim relating to the service shall not
          exceed the amount paid by you for the service in the twelve months before the claim.
        </p>
      </LegalSection>

      <LegalSection n={15} title="Changes to These Terms" id="changes">
        <p>
          We may update these terms from time to time. Continued use of the service after changes take
          effect means you accept the updated terms. We will make reasonable efforts to notify you of
          significant changes.
        </p>
      </LegalSection>

      <LegalSection n={16} title="Contact" id="contact">
        <p>
          Questions about these terms? Email us at{' '}
          <a className="legal-link" href="mailto:support.flox@gmail.com">support.flox@gmail.com</a>.
        </p>
      </LegalSection>
    </DocumentLayout>
  )
}