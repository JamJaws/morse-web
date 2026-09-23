import { useState } from 'react';
import type { MorseCodeCharacter } from './MorseCodeCharacter';
import { morseCodeCharacters } from './MorseCodeCharacters';

type TreeNode = {
  code: string;
  character?: MorseCodeCharacter;
  x: number;
  y: number;
};

const NODE_GAP = 48;
const ROW_GAP = 80;
const characters = new Map(
  morseCodeCharacters
    .filter(character => character.type !== 'punctuation')
    .map(character => [character.code, character]),
);
const prefixes = new Set(['']);
for (const code of characters.keys()) {
  for (let length = 1; length <= code.length; length++) {
    prefixes.add(code.slice(0, length));
  }
}

// Space neighboring subtrees by their row contours. This keeps a sparse tree
// compact while preserving left = dot and right = dash, including lone branches.
function layoutBranch(code: string): TreeNode[] {
  const left = prefixes.has(`${code}.`) ? layoutBranch(`${code}.`) : [];
  const right = prefixes.has(`${code}-`) ? layoutBranch(`${code}-`) : [];
  let separation = NODE_GAP;
  for (const leftNode of left) {
    for (const rightNode of right) {
      if (leftNode.y === rightNode.y) {
        separation = Math.max(separation, leftNode.x - rightNode.x + NODE_GAP);
      }
    }
  }
  return [
    {
      code,
      character: characters.get(code),
      x: 0,
      y: 32 + code.length * ROW_GAP,
    },
    ...left.map(node => ({ ...node, x: node.x - separation / 2 })),
    ...right.map(node => ({ ...node, x: node.x + separation / 2 })),
  ];
}

const layout = layoutBranch('');
const minX = Math.min(...layout.map(node => node.x));
const width = Math.max(...layout.map(node => node.x)) - minX + NODE_GAP;
const height = Math.max(...layout.map(node => node.y)) + 32;
const nodes = layout
  .map(node => ({ ...node, x: node.x - minX + NODE_GAP / 2 }))
  .sort((a, b) => a.y - b.y || a.x - b.x);
const nodesByCode = new Map(nodes.map(node => [node.code, node]));

function spokenCode(code: string) {
  return code
    .split('')
    .map(mark => (mark === '.' ? 'dot' : 'dash'))
    .join(' ');
}

export default function MorseCodeTree({
  onClick,
}: {
  onClick: (character: MorseCodeCharacter) => void;
}) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [focusedCode, setFocusedCode] = useState<string | null>(null);
  const activeCode = hoveredCode ?? focusedCode ?? selectedCode;
  const activeCharacter = activeCode ? characters.get(activeCode) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
        <p id="morse-tree-help" className="text-muted">
          Start at the top. Follow each sound to a character.
        </p>
        <div className="flex items-center gap-5 text-muted">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-accent"
            />
            Dot <span aria-hidden="true">↙</span> left
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1 w-4 rounded-full bg-accent"
            />
            Dash <span aria-hidden="true">↘</span> right
          </span>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-stroke/60 bg-canvas/50">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke/50 px-4 py-3 text-xs text-muted">
          <span>Letters &amp; numbers</span>
          <span>Punctuation is in Table</span>
        </div>
        <div
          role="group"
          aria-label="Morse code tree"
          aria-describedby="morse-tree-help morse-tree-scroll"
          className="overflow-x-auto overscroll-x-contain p-3"
        >
          <div className="relative" style={{ minWidth: width, height }}>
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              {nodes
                .filter(node => node.code)
                .map(node => {
                  const parent = nodesByCode.get(node.code.slice(0, -1))!;
                  const isActive = activeCode?.startsWith(node.code) ?? false;
                  const midX = (parent.x + node.x) / 2;
                  const midY = (parent.y + node.y) / 2;
                  return (
                    <g
                      key={node.code}
                      className={isActive ? 'text-accent' : 'text-stroke'}
                    >
                      <path
                        d={`M ${parent.x} ${parent.y} L ${node.x} ${node.y}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={isActive ? 2 : 1.5}
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={midX}
                        cy={midY}
                        r="7"
                        className="fill-canvas"
                      />
                      {node.code.endsWith('.') ? (
                        <circle cx={midX} cy={midY} r="2" fill="currentColor" />
                      ) : (
                        <path
                          d={`M ${midX - 4} ${midY} h 8`}
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      )}
                    </g>
                  );
                })}
            </svg>
            {nodes.map(node => {
              const position = {
                left: `${(node.x / width) * 100}%`,
                top: node.y,
              };
              const isOnPath = activeCode?.startsWith(node.code) ?? false;
              if (!node.code) {
                return (
                  <span
                    key="start"
                    className={`absolute inline-flex h-8 -translate-x-1/2 -translate-y-1/2 items-center rounded-full border bg-canvas px-3 text-xs font-medium ${activeCode ? 'border-accent text-accent' : 'border-stroke text-muted'}`}
                    style={position}
                  >
                    Start
                  </span>
                );
              }
              const character = node.character;
              if (!character) {
                return (
                  <span
                    key={node.code}
                    aria-hidden="true"
                    className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${isOnPath ? 'bg-accent' : 'bg-stroke'}`}
                    style={position}
                  />
                );
              }
              return (
                <button
                  key={node.code}
                  type="button"
                  aria-label={`Play ${character.letter} locally: ${spokenCode(node.code)}`}
                  aria-pressed={selectedCode === node.code}
                  onMouseEnter={() => setHoveredCode(node.code)}
                  onMouseLeave={() => setHoveredCode(null)}
                  onFocus={() => {
                    setHoveredCode(null);
                    setFocusedCode(node.code);
                  }}
                  onBlur={() => setFocusedCode(null)}
                  onClick={() => {
                    setSelectedCode(node.code);
                    onClick(character);
                  }}
                  className={`absolute inline-flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border font-mono text-lg font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                    activeCode === node.code
                      ? 'border-accent bg-accent text-accent-ink'
                      : isOnPath
                        ? 'border-accent/70 bg-raised text-accent'
                        : 'border-stroke bg-surface text-ink hover:border-accent'
                  }`}
                  style={position}
                >
                  {character.letter}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-stroke/50 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-raised font-mono text-lg text-accent"
              aria-hidden="true"
            >
              {activeCharacter?.letter ?? '·'}
            </span>
            <span className="text-sm text-muted">
              {activeCharacter ? (
                <>
                  <span className="sr-only">{activeCharacter.letter}: </span>
                  <span
                    className="font-mono tracking-widest text-accent"
                    aria-hidden="true"
                  >
                    {activeCharacter.code
                      .split('.')
                      .join('·')
                      .split('-')
                      .join('−')}
                  </span>
                  <span className="sr-only">
                    {spokenCode(activeCharacter.code)}
                  </span>
                </>
              ) : (
                'Choose a character to trace its path'
              )}
            </span>
          </div>
          <p className="text-xs text-muted">Tap a character to hear it.</p>
        </div>
      </div>
      <p id="morse-tree-scroll" className="mt-3 text-xs text-muted">
        On smaller screens, scroll sideways to explore the tree.
      </p>
    </div>
  );
}
