import { useEffect } from 'react';
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

const Landing: React.FC = () => {
  useEffect(() => {
    document.title = 'Intraconnected — Map Your Mind. Connect Your Ideas.';
  }, []);

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
      </section>
    </div>
  );
};

export default Landing;
