import { Link } from 'react-router-dom';
import LandingLogoMark from './LandingLogoMark';

interface LandingNavbarProps {
  page?: 'landing' | 'pricing';
}

const LandingNavbar: React.FC<LandingNavbarProps> = ({ page = 'landing' }) => (
  <nav className="landingNavbar">
    <Link to="/landing" className="landingNavbarBrand">
      <LandingLogoMark width={38} height={32} />
      <span className="landingNavbarBrandText">Intraconnected</span>
    </Link>
    <div className="landingNavbarLinks">
      {page === 'pricing' ? (
        <Link to="/landing" className="landingNavLink">Home</Link>
      ) : (
        <Link to="/pricing" className="landingNavLink">Pricing</Link>
      )}
      <Link to="/" className="landingNavCta neobrutal-button">Log In</Link>
    </div>
  </nav>
);

export default LandingNavbar;
