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
}

interface LineSpec {
  id: string;
  d: string;
  strokeWidth: number;
}

const NODES: NodeSpec[] = [
  { id: 'n-root', x: 289, y: 33, w: 122, h: 42, fill: 'var(--mm-roots)', originX: 350, originY: 54, label: 'Ideas', fontSize: 16, textFill: '#fff' },
  { id: 'n-music', x: 64, y: 143, w: 112, h: 42, fill: 'var(--mm-sky)', originX: 120, originY: 164, label: 'Music', fontSize: 15, textFill: '#111' },
  { id: 'n-projects', x: 284, y: 143, w: 132, h: 42, fill: 'var(--mm-sky)', originX: 350, originY: 164, label: 'Projects', fontSize: 15, textFill: '#111' },
  { id: 'n-writing', x: 519, y: 143, w: 122, h: 42, fill: 'var(--mm-sky)', originX: 580, originY: 164, label: 'Writing', fontSize: 15, textFill: '#111' },
  { id: 'n-guitar', x: 18, y: 274, w: 100, h: 38, fill: 'var(--mm-leaf)', originX: 68, originY: 293, label: 'Guitar', fontSize: 13, textFill: '#111' },
  { id: 'n-piano', x: 133, y: 274, w: 100, h: 38, fill: 'var(--mm-leaf)', originX: 183, originY: 293, label: 'Piano', fontSize: 13, textFill: '#111' },
  { id: 'n-website', x: 247, y: 274, w: 115, h: 38, fill: 'var(--mm-link)', originX: 305, originY: 293, label: 'Website', fontSize: 13, textFill: '#111' },
  { id: 'n-todo', x: 371, y: 274, w: 132, h: 88, fill: 'var(--mm-indigo)', originX: 437, originY: 318 },
  { id: 'n-novel', x: 522, y: 274, w: 100, h: 38, fill: 'var(--mm-leaf)', originX: 572, originY: 293, label: 'Novel', fontSize: 13, textFill: '#111' },
];

const LINES: LineSpec[] = [
  { id: 'l-root-music', d: 'M 350,75 C 350,109 120,109 120,143', strokeWidth: 2.5 },
  { id: 'l-root-projects', d: 'M 350,75 L 350,143', strokeWidth: 2.5 },
  { id: 'l-root-writing', d: 'M 350,75 C 350,109 580,109 580,143', strokeWidth: 2.5 },
  { id: 'l-music-guitar', d: 'M 120,185 C 120,229 68,229 68,274', strokeWidth: 2 },
  { id: 'l-music-piano', d: 'M 120,185 C 120,229 183,229 183,274', strokeWidth: 2 },
  { id: 'l-proj-website', d: 'M 350,185 C 350,229 305,229 305,274', strokeWidth: 2 },
  { id: 'l-proj-todo', d: 'M 350,185 C 350,229 437,229 437,274', strokeWidth: 2 },
  { id: 'l-write-novel', d: 'M 580,185 C 580,229 572,229 572,274', strokeWidth: 2 },
];

const NODE_TIMING: [string, number][] = [
  ['n-root', 200],
  ['n-music', 1250],
  ['n-projects', 1360],
  ['n-writing', 1470],
  ['n-guitar', 2560],
  ['n-piano', 2640],
  ['n-website', 2720],
  ['n-todo', 2810],
  ['n-novel', 2890],
];

const LINE_TIMING: [string, number][] = [
  ['l-root-music', 700],
  ['l-root-projects', 860],
  ['l-root-writing', 1020],
  ['l-music-guitar', 1950],
  ['l-music-piano', 2060],
  ['l-proj-website', 2130],
  ['l-proj-todo', 2240],
  ['l-write-novel', 2320],
];

const FADE_OUT_AT = 7300;
const LOOP_AT = 8300;

function TodoNodeContents() {
  return (
    <>
      <rect x="379" y="283" width="11" height="11" rx="2" stroke="#fff" strokeWidth="1.5" fill="none" />
      <path d="M 381,288 L 384,291 L 388,285" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="394" y="289" textAnchor="start" dominantBaseline="middle" fontWeight="700" fontSize="13" fill="#fff">To-Do List</text>
      <line x1="371" y1="301" x2="503" y2="301" stroke="#fff" strokeWidth="1" strokeOpacity="0.25" />
      <rect x="379" y="307" width="10" height="10" rx="2" fill="#fff" fillOpacity="0.25" stroke="#fff" strokeOpacity="0.6" strokeWidth="1" />
      <path d="M 381,312 L 383.5,314.5 L 387,309.5" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <text x="393" y="312" dominantBaseline="middle" fontSize="11" fill="#fff" fillOpacity="0.42">Buy groceries</text>
      <rect x="379" y="322" width="10" height="10" rx="2" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1" />
      <text x="393" y="327" dominantBaseline="middle" fontSize="11" fill="#fff">Call dentist</text>
      <rect x="379" y="337" width="10" height="10" rx="2" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="1" />
      <text x="393" y="342" dominantBaseline="middle" fontSize="11" fill="#fff">Fix bug #42</text>
    </>
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
    <svg viewBox="0 0 700 372" width="100%" className="mmSvg">
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
              ) : (
                <text
                  x={node.originX}
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
            </g>
          );
        })}
      </g>
    </svg>
  );
};

export default MindMapHeroAnimation;
