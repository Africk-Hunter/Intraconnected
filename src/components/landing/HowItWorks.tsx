const Cursor: React.FC<{ className: string; x: number; y: number }> = ({ className, x, y }) => (
  <g className={className}>
    <path
      d={`M ${x},${y} l 0,16 l 4.5,-4 l 3.5,8 l 3,-1.4 l -3.5,-7.8 l 6,-0.3 z`}
      fill="#fff"
      stroke="#111"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </g>
);

const Node: React.FC<{
  x: number;
  y: number;
  w: number;
  fill: string;
  label: string;
  className?: string;
  textFill?: string;
}> = ({ x, y, w, fill, label, className, textFill = '#111' }) => (
  <g className={className}>
    <rect x={x + 2.5} y={y + 2.5} width={w} height={28} rx="6" fill="#111" />
    <rect x={x} y={y} width={w} height={28} rx="6" fill={fill} stroke="#111" strokeWidth="2" />
    <text
      x={x + w / 2}
      y={y + 14.5}
      textAnchor="middle"
      dominantBaseline="middle"
      fontWeight="700"
      fontSize="12"
      fill={textFill}
    >
      {label}
    </text>
  </g>
);

const Line: React.FC<{ d: string; className?: string }> = ({ d, className }) => (
  <path
    d={d}
    pathLength={1}
    stroke="#111"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    className={className}
  />
);

const STEPS = [
  {
    title: 'Capture an idea',
    body: 'Add a node and start typing. Every idea hangs off the one before it.',
  },
  {
    title: 'Zoom into a branch',
    body: 'Click any node to dive into its details. Head back out whenever you like.',
  },
  {
    title: 'Drag to reorganize',
    body: 'Drop a node onto another to move it. Your map reshapes instantly.',
  },
];

const HowItWorks: React.FC = () => (
  <section className="landingHowItWorks" aria-labelledby="landingHowTitle">
    <div className="landingHowHeader">
      <h2 id="landingHowTitle" className="landingHowTitle">How it works</h2>
    </div>

    <ol className="landingHowSteps">
      <li className="howStep neobrutal">
        <div className="howScene" aria-hidden="true">
          <svg viewBox="0 0 240 150" width="100%">
            <g className="howS1">
              <Line className="howS1-line1" d="M 120,44 C 120,74 60,74 60,100" />
              <Line className="howS1-line2" d="M 120,44 C 120,74 180,74 180,100" />
              <Node x={85} y={16} w={70} fill="var(--mm-roots)" label="Trip" textFill="#fff" />
              <Node className="howS1-node1" x={25} y={100} w={70} fill="var(--mm-leaf)" label="Flights" />
              <Node className="howS1-node2" x={145} y={100} w={70} fill="var(--mm-leaf)" label="Hotels" />
            </g>
          </svg>
        </div>
        <span className="howStepNumber">1</span>
        <h3 className="howStepTitle">{STEPS[0].title}</h3>
        <p className="howStepBody">{STEPS[0].body}</p>
      </li>

      <li className="howStep neobrutal">
        <div className="howScene" aria-hidden="true">
          <svg viewBox="0 0 240 150" width="100%">
            <g className="howS2-a">
              <text x="12" y="22" fontSize="11" fontWeight="700" fill="#111">Ideas</text>
              <Node x={8} y={62} w={66} fill="var(--mm-sky)" label="Music" />
              <Node x={87} y={62} w={66} fill="var(--mm-sky)" label="Projects" />
              <Node x={166} y={62} w={66} fill="var(--mm-sky)" label="Writing" />
            </g>
            <g className="howS2-b">
              <text x="12" y="22" fontSize="11" fontWeight="700" fill="#111">Ideas › Projects</text>
              <Node className="howS2-b1" x={25} y={62} w={80} fill="var(--mm-link)" label="Website" />
              <Node className="howS2-b2" x={125} y={62} w={90} fill="var(--mm-leaf)" label="Launch" />
            </g>
            <Cursor className="howS2-cursor" x={112} y={72} />
          </svg>
        </div>
        <span className="howStepNumber">2</span>
        <h3 className="howStepTitle">{STEPS[1].title}</h3>
        <p className="howStepBody">{STEPS[1].body}</p>
      </li>

      <li className="howStep neobrutal">
        <div className="howScene" aria-hidden="true">
          <svg viewBox="0 0 240 150" width="100%">
            <g className="howS3">
              <Line className="howS3-line" d="M 55,44 L 55,100" />
              <Node x={20} y={16} w={70} fill="var(--mm-sky)" label="Music" />
              <Node x={150} y={16} w={70} fill="var(--mm-sky)" label="Writing" />
              <g className="howS3-drag">
                <Node x={140} y={100} w={70} fill="var(--mm-leaf)" label="Guitar" />
                <Cursor className="howS3-cursor" x={186} y={112} />
              </g>
            </g>
          </svg>
        </div>
        <span className="howStepNumber">3</span>
        <h3 className="howStepTitle">{STEPS[2].title}</h3>
        <p className="howStepBody">{STEPS[2].body}</p>
      </li>
    </ol>
  </section>
);

export default HowItWorks;
