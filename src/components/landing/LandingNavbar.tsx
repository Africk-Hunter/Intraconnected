import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandLogo';

interface LandingNavbarProps {
  page?: 'landing' | 'pricing' | 'support';
}

const LandingNavbar: React.FC<LandingNavbarProps> = ({ page = 'landing' }) => (
  <nav className="landingNavbar">
    <Link to="/" className="landingNavbarBrand">
      <BrandMark className="landingNavbarMark" />
      <span className="landingNavbarBrandText">Intraconnected</span>
    </Link>
    <div className="landingNavbarLinks">
      {page !== 'landing' && <Link to="/" className="landingNavLink">Home</Link>}
      {page !== 'pricing' && <Link to="/pricing" className="landingNavLink">Pricing</Link>}
      <Link to="/login" className="landingNavCta neobrutal-button">Log In</Link>
    </div>
  </nav>
);

export default LandingNavbar;
