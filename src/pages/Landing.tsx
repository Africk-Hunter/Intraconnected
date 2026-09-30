import { Link } from 'react-router-dom';
import FeatureCard from '../components/landing/FeatureCard';
import MindMapHeroAnimation from '../components/landing/MindMapHeroAnimation';

const ZoomIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <circle cx="11" cy="11" r="7.5" stroke="#111" strokeWidth="2.5" />
    <line x1="17" y1="17" x2="24" y2="24" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="11" y1="8" x2="11" y2="14" stroke="#111" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="11" x2="14" y2="11" stroke="#111" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const DragIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <path d="M13 3v20M3 13h20" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M10 6l3-3 3 3" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 20l3 3 3-3" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10l-3 3 3 3" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 10l3 3-3 3" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChecklistIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <rect x="4" y="4" width="18" height="18" rx="3" stroke="#111" strokeWidth="2.5" />
    <path d="M8 13l3.5 3.5 6.5-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
    <rect x="4.5" y="11" width="17" height="12" rx="2.5" stroke="#111" strokeWidth="2.5" />
    <path d="M8.5 11V8a4.5 4.5 0 0 1 9 0v3" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="13" y1="15.5" x2="13" y2="18.5" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const Landing: React.FC = () => {
  return (
    <div className="landingPage">
      <section className="landingHero">
        <h1 className="landingHeroTitle">Map your mind.<br />Connect your ideas.</h1>
        <p className="landingHeroSubline">
          A node-based mind-mapping tool for organizing thoughts hierarchically, from broad
          strokes down to the finest details.
        </p>

        <div className="landingMindMapBox">
          <MindMapHeroAnimation />
        </div>

        <Link to="/" className="landingCta neobrutal-button">Get Started Free →</Link>
      </section>

      <section className="landingFeatures">
        <FeatureCard variant="white" iconBg="var(--mm-sky)" icon={<ZoomIcon />} title="Zoom into any node">
          Focus on any branch and explore it in full depth, without losing sight of the big
          picture.
        </FeatureCard>
        <FeatureCard variant="yellow" iconBg="#fff" icon={<DragIcon />} title="Drag to reorganize">
          Drag nodes anywhere and reshape how your ideas connect in real time.
        </FeatureCard>
        <FeatureCard variant="indigo" iconBg="var(--mm-bg)" icon={<ChecklistIcon />} title="Checklists built in">
          Turn any node into an actionable checklist and keep tasks right inside your mind map.
        </FeatureCard>
        <p className="landingNoLockIn">
          No lock-in: export your whole map to Markdown, OPML or JSON anytime, on any plan.
        </p>
      </section>

      {/* Wording must stay in step with Privacy.tsx "How Your Data Is
          Protected": this is client-side encryption with an email-recovery
          key, NOT end-to-end — never claim "only you can decrypt" or "we
          cannot read" here (see CLAUDE.md → Client-side encryption). */}
      <section className="landingSecurity" aria-labelledby="landingSecurityTitle">
        <div className="landingSecurityHeader">
          <div className="landingSecurityIcon"><LockIcon /></div>
          <h2 id="landingSecurityTitle" className="landingSecurityTitle">How your ideas are protected</h2>
          <p className="landingSecuritySubline">Plain answers, including the trade-off.</p>
        </div>

        <ol className="landingSecuritySteps">
          <li className="securityStep neobrutal">
            <span className="securityStepNumber">1</span>
            <h3 className="securityStepTitle">Encrypted on your device</h3>
            <p className="securityStepBody">
              Your ideas are locked with AES-256-GCM in your browser before they're sent
              anywhere. Nothing readable leaves your device.
            </p>
          </li>
          <li className="securityStep neobrutal">
            <span className="securityStepNumber">2</span>
            <h3 className="securityStepTitle">Stored scrambled</h3>
            <p className="securityStepBody">
              Our database holds the encrypted version, not your readable ideas. We don't
              look at your ideas, and there are no ads, trackers or analytics.
            </p>
          </li>
          <li className="securityStep securityStep--tradeoff neobrutal">
            <span className="securityStepNumber">3</span>
            <h3 className="securityStepTitle">Recoverable if you forget your password</h3>
            <p className="securityStepBody">
              We keep a recovery copy of your key tied to your email, so a password reset
              doesn't wipe your ideas. The trade-off: someone with access to both our
              database and your account details, including us, could technically decrypt
              them. We don't, and won't unless required by law.
            </p>
          </li>
        </ol>

        <div className="securityScope neobrutal">
          <div className="securityScopeCol">
            <h3 className="securityScopeTitle">Encrypted</h3>
            <ul>
              <li>Idea and note text</li>
              <li>Links</li>
              <li>Checklist items and their links</li>
            </ul>
          </div>
          <div className="securityScopeCol securityScopeCol--plain">
            <h3 className="securityScopeTitle">Not encrypted</h3>
            <ul>
              <li>Your email address</li>
              <li>How your ideas are arranged (what's inside what)</li>
              <li>Priorities and checked/unchecked state</li>
              <li>Your plan</li>
            </ul>
          </div>
        </div>

        <Link to="/privacy" className="securityMoreLink">Full details in our Privacy Policy →</Link>
      </section>
    </div>
  );
};

export default Landing;
