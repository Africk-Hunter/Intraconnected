import { Link } from 'react-router-dom';
import HowItWorks from '../components/landing/HowItWorks';
import MindMapHeroAnimation from '../components/landing/MindMapHeroAnimation';

const Landing: React.FC = () => {
  return (
    <div className="landingPage">
      {/* Labels follow the app's node types: green leaf = one idea, blue parent
          = has ideas inside (count ›), yellow = saved link (↗), indigo = checklist. */}
      <span className="heroFloater heroFloater--leaf" aria-hidden="true">Learn guitar</span>
      <span className="heroFloater heroFloater--sky" aria-hidden="true">Projects <small>3 ›</small></span>
      <span className="heroFloater heroFloater--link" aria-hidden="true">Article <small>↗</small></span>
      <span className="heroFloater heroFloater--indigo" aria-hidden="true">Packing <small>3/5</small></span>
      <span className="heroFloater heroFloater--sky2" aria-hidden="true">Travel <small>5 ›</small></span>
      <span className="heroFloater heroFloater--leaf2" aria-hidden="true">Podcast idea</span>
      <span className="heroFloater heroFloater--indigo2" aria-hidden="true">Groceries <small>2/4</small></span>
      <span className="heroFloater heroFloater--link2" aria-hidden="true">Design ref <small>↗</small></span>
      <span className="heroFloater heroFloater--leaf3" aria-hidden="true">Write a novel</span>
      <span className="heroFloater heroFloater--sky3" aria-hidden="true">Recipes <small>8 ›</small></span>

      <section className="landingHero">
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
