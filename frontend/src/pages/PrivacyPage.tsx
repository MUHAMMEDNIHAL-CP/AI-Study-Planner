import DocumentLayout from '../components/DocumentLayout'
import { LegalList, LegalSection, LegalToc, type TOCItem } from '../components/legal'

const TOC: TOCItem[] = [
  { id: 'collect', n: 1, label: 'Information We Collect' },
  { id: 'use', n: 2, label: 'How We Use Your Information' },
  { id: 'ai', n: 3, label: 'AI & FLOX' },
  { id: 'study', n: 4, label: 'Study Data' },
  { id: 'cookies', n: 5, label: 'Cookies & Advertising' },
  { id: 'storage', n: 6, label: 'Data Storage' },
  { id: 'sharing', n: 7, label: 'Data Sharing' },
  { id: 'rights', n: 8, label: 'Your Rights' },
  { id: 'deletion', n: 9, label: 'Account Deletion' },
  { id: 'children', n: 10, label: "Children's Privacy" },
  { id: 'changes', n: 11, label: 'Changes to This Policy' },
  { id: 'contact', n: 12, label: 'Contact Us' },
]

export default function PrivacyPage() {
  return (
    <DocumentLayout
      eyebrow="Legal &middot; Data"
      title="Privacy Policy"
      subtitle="FocusFlow AI respects your privacy and is committed to protecting your personal information."
    >
      <p className="legal-updated">Last updated: September 1, 2026</p>

      <p className="legal-intro">
        This policy explains what information FocusFlow AI collects, how we use it, and the choices you
        have. By using FocusFlow AI you agree to the practices described here.
      </p>

      <LegalToc items={TOC} />

      <LegalSection n={1} title="Information We Collect" id="collect">
        <p>We collect the information you provide when you sign up and use the app, including:</p>
        <LegalList
          items={[
            <>Your <strong>name</strong> and <strong>email address</strong>.</>,
            <>Your <strong>login credentials</strong>, stored as a securely hashed password and used only for token-based authentication.</>,
            <>Your <strong>study content</strong>: subjects, exams, tasks, study plans and schedule preferences.</>,
            <>Your <strong>study sessions</strong>: focus-mode sessions you complete, study times and session durations.</>,
            <>Your <strong>notes</strong>.</>,
            <>Your <strong>quiz results</strong> and answer history.</>,
            <>Your <strong>streak and progress</strong> information.</>,
            <>Your <strong>AI interactions</strong> with FLOX AI, including the messages you send and the responses we generate.</>,
            <>Your <strong>preferences</strong>, such as reminders, focus timers, language and timezone.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={2} title="How We Use Your Information" id="use">
        <p>We use your information to operate and improve the app:</p>
        <LegalList
          items={[
            <>To <strong>provide the service</strong>: build study plans, track progress, run focus sessions and quizzes.</>,
            <>To <strong>power FLOX AI</strong> features, as described in the AI &amp; FLOX section.</>,
            <>To remember your <strong>settings and preferences</strong>.</>,
            <>To <strong>support you</strong> when you contact us.</>,
            <>To <strong>improve the product</strong> by understanding how features are used.</>,
          ]}
        />
        <p>We do not sell your personal information.</p>
      </LegalSection>

      <LegalSection n={3} title="AI & FLOX" id="ai">
        <p>
          FLOX AI generates responses, study plans, explanations and quizzes based on your request and
          relevant study context (for example your subjects, upcoming exams and quiz history).
        </p>
        <LegalList
          items={[
            <>When you use FLOX AI, the information necessary to <strong>process your request</strong> may be sent to our AI provider (Google Gemini) to generate a response.</>,
            <>We send only what is needed to answer your question, and we use the smallest practical context.</>,
            <>Your <strong>AI interactions are stored</strong> in your account so you can revisit them.</>,
            <>We do not sell AI conversations, and we do not knowingly use your study data to train models.</>,
            <><strong>AI output can be wrong.</strong> Responses are generated and may contain errors, so verify anything important before relying on it.</>,
            <>Avoid entering sensitive personal information into FLOX AI.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={4} title="Study Data" id="study">
        <p>
          Your study data &mdash; subjects, tasks, exams, notes, quiz results, sessions and progress &mdash;
          belongs to you. It is stored in your account and used to personalize your study experience. We
          do not share your study data with other users or third parties for marketing.
        </p>
      </LegalSection>

      <LegalSection n={5} title="Cookies & Advertising" id="cookies">
        <p>
          FocusFlow AI does not currently run third-party advertising and does not use advertising
          cookies or tracking identifiers for marketing.
        </p>
        <LegalList
          items={[
            <>We use <strong>local storage</strong> in your browser to keep you signed in and remember preferences. Authentication is token-based.</>,
            <>The <strong>watch-an-ad</strong> reward flow for bonus FLOX AI requests is being built. If or when we introduce advertising, we will update this policy to describe the technology, any cookies or identifiers used, and how you can manage advertising preferences.</>,
          ]}
        />
      </LegalSection>

      <LegalSection n={6} title="Data Storage" id="storage">
        <p>
          Your data is stored on servers we control and protected with appropriate safeguards. We retain
          your information for as long as your account is active, so the features you use keep working.
          When you delete your account, we delete your data in line with the Account Deletion section.
        </p>
      </LegalSection>

      <LegalSection n={7} title="Data Sharing" id="sharing">
        <LegalList
          items={[
            <>To our <strong>AI provider</strong> (Google Gemini) solely to generate responses, as described in the AI &amp; FLOX section.</>,
            <>To <strong>service providers</strong> that host or operate the app on our behalf, bound by confidentiality.</>,
            <>Where <strong>required by law</strong>, or to protect the rights and safety of users or the public.</>,
          ]}
        />
        <p>Outside of these cases, we do not share your personal information.</p>
      </LegalSection>

      <LegalSection n={8} title="Your Rights" id="rights">
        <p>Depending on where you live, you may have the right to:</p>
        <LegalList
          items={[
            <>Access the personal information we hold about you.</>,
            <>Correct or update your information.</>,
            <>Download a copy of your data (Settings &gt; Data &amp; Privacy &gt; Download My Data).</>,
            <>Request deletion of your data.</>,
            <>Object to or restrict how we process your data.</>,
          ]}
        />
        <p>To exercise any of these rights, contact us using the details in the Contact Us section.</p>
      </LegalSection>

      <LegalSection n={9} title="Account Deletion" id="deletion">
        <p>
          You can request account deletion from Settings &gt; Data &amp; Privacy. When your account is
          deleted, your profile, study content, notes, quiz history, sessions, progress and AI
          interactions are removed. We keep only the minimum required by law or for security purposes.
        </p>
      </LegalSection>

      <LegalSection n={10} title="Children's Privacy" id="children">
        <p>
          FocusFlow AI is not directed at children under the age of 13, and we do not knowingly collect
          personal information from children. If you believe a child has provided us with personal
          information, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Changes to This Policy" id="changes">
        <p>
          We may update this policy from time to time. When we do, we will revise the
          &ldquo;Last updated&rdquo; date at the top of this page. Significant changes will be highlighted
          in the app so you can review them before continuing to use FocusFlow AI.
        </p>
      </LegalSection>

      <LegalSection n={12} title="Contact Us" id="contact">
        <p>
          Questions about this policy or your data? Email us at{' '}
          <a className="legal-link" href="mailto:support.flox@gmail.com">support.flox@gmail.com</a>. We&apos;ll do
          our best to help.
        </p>
      </LegalSection>
    </DocumentLayout>
  )
}