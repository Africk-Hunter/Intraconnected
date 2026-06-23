import React from 'react';

const HelpMenuOne: React.FC = () => {
    return (
        <section className="textSection">
            <div className="help-one-title-row">
                <h1 className="header">
                    Welcome to<br />
                    Intraconnected
                </h1>
                <svg
                    className="help-one-anim"
                    viewBox="0 0 95 76"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <line x1="24" y1="37" x2="66" y2="18" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
                    <line x1="24" y1="37" x2="66" y2="58" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />

                    <rect x="2" y="27" width="22" height="22" rx="4" fill="#A3703E" stroke="#111" strokeWidth="2" className="help-one-root-pulse" />
                    <rect x="66" y="8" width="24" height="20" rx="4" fill="#41BC28" stroke="#111" strokeWidth="2" />
                    <rect x="66" y="48" width="24" height="20" rx="4" fill="#00A9D8" stroke="#111" strokeWidth="2" />

                    <circle r="4" fill="#41BC28" stroke="#111" strokeWidth="1.5">
                        <animateMotion dur="1.6s" repeatCount="indefinite" begin="0s" path="M 24 37 L 66 18" />
                    </circle>
                    <circle r="4" fill="#00A9D8" stroke="#111" strokeWidth="1.5">
                        <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.8s" path="M 24 37 L 66 58" />
                    </circle>
                </svg>
            </div>
            <p className="details">
                Intraconnected is like a visual canvas for your ideas.
                <br />
                <br />
                Everything starts with a root idea. From there, you can build and explore related ideas as a growing network. Click to dive into any idea and make it the new root.
                <br />
                <br />
                It's all about building connections that you can explore intuitively, not just keeping track of scattered notes.
            </p>
        </section>
    );
};

export default HelpMenuOne;