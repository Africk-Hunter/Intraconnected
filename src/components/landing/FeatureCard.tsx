import type { ReactNode } from 'react';

interface FeatureCardProps {
  variant: 'white' | 'yellow' | 'indigo';
  iconBg: string;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ variant, iconBg, icon, title, children }) => (
  <div className={`featureCard featureCard--${variant} neobrutal`}>
    <div className="featureCardIcon" style={{ background: iconBg }}>
      {icon}
    </div>
    <h3 className="featureCardTitle">{title}</h3>
    <p className="featureCardBody">{children}</p>
  </div>
);

export default FeatureCard;
