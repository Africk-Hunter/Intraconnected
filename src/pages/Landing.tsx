import { Link } from 'react-router-dom';
import HowItWorks from '../components/landing/HowItWorks';
import MindMapHeroAnimation from '../components/landing/MindMapHeroAnimation';

const Landing: React.FC = () => {
  return (
    <div className="landingPage">
      <section className="landingHero">
        <span className="heroFloater heroFloater--leaf" aria-hidden="true">Idea</span>
        <span className="heroFloater heroFloater--sky" aria-hidden="true">Plan</span>
        <span className="heroFloater heroFloater--link" aria-hidden="true">Link</span>
        <span className="heroFloater heroFloater--indigo" aria-hidden="true">To-do</span>

        <h1 className="landingHeroTitle">
          <span className="heroMark heroMark--leaf">Map your mind.</span>
          <br />
          <span className="heroMark heroMark--sky">Connect your ideas.</span>
        </h1>
        <p className="landingHeroSubline">
          A node-based mind-mapping tool for organizing thoughts hierarchically, from broad
          strokes down to the finest details.
        </p>

        <div className="landingMindMapBox">
          <MindMapHeroAnimation />
        </div>

        <Link to="/login" className="landingCta neobrutal-button">Get Started Free →</Link>
      </section>

      <HowItWorks />

      <section className="landingFinalCta">
        <div className="landingFinalCtaCard neobrutal">
          <h2 className="landingFinalCtaTitle">Got an idea? Start with one node.</h2>
          <Link to="/login" className="landingCta neobrutal-button">Get Started Free →</Link>
        </div>
      </section>
    </div>
  );
};

export default Landing;
