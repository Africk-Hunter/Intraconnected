import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface NodeSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  originX: number;
  originY: number;
  label?: string;
  fontSize?: number;
  textFill?: string;
  arrow?: boolean;
}

interface LineSpec {
  id: string;
  d: string;
  strokeWidth: number;
}

const NODES: NodeSpec[] = [
  { id: 'n-root', x: 271, y: 33, w: 122, h: 42, fill: 'var(--mm-roots)', originX: 332, originY: 54, label: 'Ideas', fontSize: 16, textFill: '#fff' },
  { id: 'n-music', x: 115, y: 143, w: 112, h: 42, fill: 'var(--mm-sky)', originX: 171, originY: 164, label: 'Music', fontSize: 15, textFill: '#111' },
  { id: 'n-projects', x: 362, y: 143, w: 132, h: 42, fill: 'var(--mm-sky)', originX: 428, originY: 164, label: 'Projects', fontSize: 15, textFill: '#111' },
  { id: 'n-writing', x: 523, y: 143, w: 122, h: 42, fill: 'var(--mm-sky)', originX: 584, originY: 164, label: 'Writing', fontSize: 15, textFill: '#111' },
  { id: 'n-note', x: 18, y: 274, w: 134, h: 100, fill: 'var(--mm-note)', originX: 85, originY: 324 },
  { id: 'n-vault', x: 192, y: 274, w: 130, h: 100, fill: 'var(--mm-vault)', originX: 257, originY: 324 },
  { id: 'n-todo', x: 362, y: 274, w: 132, h: 88, fill: 'var(--mm-indigo)', originX: 428, originY: 318 },
  { id: 'n-insp', x: 528, y: 274, w: 112, h: 42, fill: 'var(--mm-sky)', originX: 584, originY: 295, label: 'Inspiration', fontSize: 14, textFill: '#111' },
  { id: 'n-jurassic', x: 519, y: 358, w: 130, h: 38, fill: 'var(--mm-link)', originX: 584, originY: 377, label: 'Jurassic Park', fontSize: 13, textFill: '#111', arrow: true },
];

const LINES: LineSpec[] = [
  { id: 'l-root-music', d: 'M 332,75 C 332,109 171,109 171,143', strokeWidth: 2.5 },
  { id: 'l-root-projects', d: 'M 332,75 C 332,109 428,109 428,143', strokeWidth: 2.5 },
  { id: 'l-root-writing', d: 'M 332,75 C 332,109 584,109 584,143', strokeWidth: 2.5 },
  { id: 'l-music-note', d: 'M 171,185 C 171,229 85,229 85,274', strokeWidth: 2 },
  { id: 'l-music-vault', d: 'M 171,185 C 171,229 257,229 257,274', strokeWidth: 2 },
  { id: 'l-proj-todo', d: 'M 428,185 L 428,274', strokeWidth: 2 },
  { id: 'l-write-insp', d: 'M 584,185 L 584,274', strokeWidth: 2 },
  { id: 'l-insp-jur', d: 'M 584,316 L 584,358', strokeWidth: 2 },
];

const NODE_TIMING: [string, number][] = [
  ['n-root', 200],
  ['n-music', 1250],
  ['n-projects', 1360],
  ['n-writing', 1470],
  ['n-note', 2560],
  ['n-vault', 2680],
  ['n-todo', 2770],
  ['n-insp', 2860],
  ['n-jurassic', 3200],
];

const LINE_TIMING: [string, number][] = [
  ['l-root-music', 700],
  ['l-root-projects', 860],
  ['l-root-writing', 1020],
  ['l-music-note', 1950],
  ['l-music-vault', 2080],
  ['l-proj-todo', 2180],
  ['l-write-insp', 2280],
  ['l-insp-jur', 3050],
];

const FADE_OUT_AT = 7300;
const LOOP_AT = 8300;

function TodoNodeContents() {
  return (
    <g transform="translate(-9 0)">
      <rect x="379" y="283" width="11" height="11" rx="2" stroke="#fff" strokeWidth="1.5" fill="none" />
      <path d="M 381,288 L 384,291 L 388,285" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="394" y="289" textAnchor="start" dominantBaseline="middle" fontWeight="700" fontSize="13" fill="#fff">To-Do List</text>
      <line x1="371" y1="301" x2="503" y2="301" stroke="#fff" strokeWidth="1" strokeOpacity="0.25" />
      <rect x="379" y="307" width="10" height="10" rx="2" fill="#fff" fillOpacity="0.25" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" />
      <path d="M 381,312 L 383.5,314.5 L 387,309.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="393" y="312" dominantBaseline="middle" fontSize="11" fill="#fff" fillOpacity="0.42">Buy domain</text>
      <rect x="379" y="322" width="10" height="10" rx="2" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1" />
      <text x="393" y="327" dominantBaseline="middle" fontSize="11" fill="#fff">Design logo</text>
      <rect x="379" y="337" width="10" height="10" rx="2" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1" />
      <text x="393" y="342" dominantBaseline="middle" fontSize="11" fill="#fff">Ship MVP</text>
    </g>
  );
}

// Same anatomy as the app's note card: bold title, divider, monospace body.
function NoteNodeContents({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x="10" y="17" dominantBaseline="middle" fontWeight="700" fontSize="13" fill="#fff">Song idea</text>
      <line x1="0" y1="32" x2={w} y2="32" stroke="#fff" strokeWidth="1" strokeOpacity="0.25" />
      <g fontFamily="'Courier Prime', 'Courier New', monospace" fontSize="10.5" fill="#fff">
        <text x="10" y="48" dominantBaseline="middle">Open with a</text>
        <text x="10" y="63" dominantBaseline="middle">slow riff, then</text>
        <text x="10" y="78" dominantBaseline="middle">drop the beat.</text>
      </g>
    </g>
  );
}

// Same anatomy as the app's vault card: violet head, recessed secret slot, lock chip.
function VaultNodeContents({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x="10" y="13" dominantBaseline="middle" fontWeight="800" fontSize="7.5" letterSpacing="0.8" fill="#fff" fillOpacity="0.65">VAULT NOTE</text>
      <text x="10" y="27" dominantBaseline="middle" fontWeight="700" fontSize="10.5" fill="#fff">FL Studio Password</text>
      <line x1="0" y1="38" x2={w} y2="38" stroke="#fff" strokeWidth="1" strokeOpacity="0.22" />
      <rect x="10" y="46" width={w - 20} height="22" rx="4" fill="var(--mm-vault-deep)" stroke="#111" strokeWidth="1.5" />
      <text x="18" y="59" dominantBaseline="middle" fontSize="13" letterSpacing="1.5" fill="#fff" fillOpacity="0.9">••••••••</text>
      <rect x="11" y="77" width="58" height="16" rx="8" fill="var(--mm-link)" stroke="#111" strokeWidth="1.5" />
      <g transform="translate(17 79.5) scale(0.46)" fill="none" stroke="#111" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      </g>
      <text x="31" y="85.5" dominantBaseline="middle" fontWeight="800" fontSize="9" fill="#111">Locked</text>
    </g>
  );
}

const MindMapHeroAnimation: React.FC = () => {
  const [cycle, setCycle] = useState(0);
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [visibleLines, setVisibleLines] = useState<Set<string>>(new Set());
  const [fadingOut, setFadingOut] = useState(false);
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({});

  useEffect(() => {
    setVisibleNodes(new Set());
    setVisibleLines(new Set());
    setFadingOut(false);

    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(setTimeout(fn, ms));
    };

    NODE_TIMING.forEach(([id, delay]) =>
      after(delay, () => setVisibleNodes((prev) => new Set(prev).add(id)))
    );
    LINE_TIMING.forEach(([id, delay]) =>
      after(delay, () => setVisibleLines((prev) => new Set(prev).add(id)))
    );
    after(FADE_OUT_AT, () => setFadingOut(true));
    after(LOOP_AT, () => setCycle((c) => c + 1));

    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  useLayoutEffect(() => {
    LINES.forEach(({ id }) => {
      const el = pathRefs.current[id];
      if (!el) return;
      const len = el.getTotalLength();
      el.style.setProperty('--mm-len', String(len));
    });
  }, []);

  return (
    <svg viewBox="0 0 664 408" width="100%" className="mmSvg">
      <g className={fadingOut ? 'mmGroup mmGroup--fading' : 'mmGroup'}>
        {LINES.map((line) => (
          <path
            key={line.id}
            ref={(el) => {
              pathRefs.current[line.id] = el;
            }}
            d={line.d}
            stroke="#111"
            strokeWidth={line.strokeWidth}
            fill="none"
            strokeLinecap="round"
            className={visibleLines.has(line.id) ? 'mmLine mmLine--drawn' : 'mmLine'}
          />
        ))}

        {NODES.map((node) => {
          const visible = visibleNodes.has(node.id);
          const style = { transformOrigin: `${node.originX}px ${node.originY}px` };
          return (
            <g
              key={node.id}
              className={visible ? 'mmNode mmNode--visible' : 'mmNode'}
              style={style}
            >
              <rect x={node.x + 3} y={node.y + 3} width={node.w} height={node.h} rx="7" fill="#111" />
              <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="7" fill={node.fill} stroke="#111" strokeWidth="2.5" />
              {node.id === 'n-todo' ? (
                <TodoNodeContents />
              ) : node.id === 'n-note' ? (
                <NoteNodeContents x={node.x} y={node.y} w={node.w} />
              ) : node.id === 'n-vault' ? (
                <VaultNodeContents x={node.x} y={node.y} w={node.w} />
              ) : (
                <text
                  x={node.originX - (node.arrow ? 9 : 0)}
                  y={node.originY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontWeight="700"
                  fontSize={node.fontSize}
                  fill={node.textFill}
                >
                  {node.label}
                </text>
              )}
              {node.arrow && (
                <path
                  d={`M ${node.x + node.w - 22},${node.originY + 4} L ${node.x + node.w - 12},${node.originY - 5} M ${node.x + node.w - 20},${node.originY - 5} L ${node.x + node.w - 12},${node.originY - 5} L ${node.x + node.w - 12},${node.originY + 3}`}
                  stroke="#111"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default MindMapHeroAnimation;
