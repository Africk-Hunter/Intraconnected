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
          <span className="heroMark heroMark--leaf">Plant a node.</span>
          <br />
          <span className="heroMark heroMark--sky">Grow an{' '}
            <span className="heroScribbleWord">
              <i>idea</i>
              <svg className="heroScribble" viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true">
                <path d="M3 8 C 35 4, 80 3, 117 5" />
                <path d="M22 12.5 C 50 10.5, 80 10.5, 100 11.5" />
              </svg>
            </span>
            .
          </span>
        </h1>
        <p className="landingHeroSubline">
          Start with a rough thought. Break it into parts, add the to-dos and the links,
          and lock away what's private. Intraconnected keeps all of it on one tree.
        </p>

        <div className="landingMindMapBox">
          <MindMapHeroAnimation />
        </div>

        <Link to="/login" className="landingCta neobrutal-button">
          Start growing for free
          <svg className="ctaArrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M14 7l7 5-7 5" />
          </svg>
        </Link>
        <p className="landingHeroFine">50 nodes free. No card.</p>
      </section>

      <HowItWorks />

      <section className="landingFinalCta">
        <div className="landingFinalCtaCard neobrutal">
          <h2 className="landingFinalCtaTitle">Got a thought you can't shake? Plant it.</h2>
          <Link to="/login" className="landingCta neobrutal-button">
          Start growing for free
          <svg className="ctaArrow" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M14 7l7 5-7 5" />
          </svg>
        </Link>
        </div>
      </section>
    </div>
  );
};

export default Landing;
