import React from "react";
import { Users, Building2, ClipboardList, User, Briefcase, CheckCircle2, MapPin, TrendingUp } from "lucide-react";

// Icon map by node id
const ICON_MAP = {
  age_group:                   Users,
  socioeconomic_group:         TrendingUp,
  college_graduation_year_gap: Building2,
  employment_gap:              Briefcase,
  neighborhood_quality:        MapPin,
  test_score:                  ClipboardList,
  experience:                  User,
  experience_years:            User,
  hired:                       CheckCircle2,
};

// Color map by node type
const TYPE_COLORS = {
  protected:  { fill: "#6d28d9", stroke: "#c4b5fd", edge: "#8b5cf6" },
  proxy:      { fill: "#be123c", stroke: "#fda4af", edge: "#fb7185" },
  legitimate: { fill: "#0f766e", stroke: "#5eead4", edge: "#2dd4bf" },
  outcome:    { fill: "#334155", stroke: "#cbd5e1", edge: "#94a3b8" },
};

// Static fallback layout positions (viewBox 900 x 420)
const STATIC_POSITIONS = {
  age_group:                   [100, 160],
  socioeconomic_group:         [100, 320],
  college_graduation_year_gap: [320, 80],
  employment_gap:              [320, 240],
  neighborhood_quality:        [320, 380],
  test_score:                  [560, 80],
  experience:                  [560, 240],
  experience_years:            [560, 240],
  hired:                       [800, 220],
};

const RADIUS = 36;
const VB_W = 940;
const VB_H = 440;

function getPos(id, nodes) {
  return STATIC_POSITIONS[id] || [VB_W / 2, VB_H / 2];
}

function adjustEdge(ax, ay, bx, by, padStart = RADIUS, padEnd = RADIUS + 8) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x1: ax + (dx / len) * padStart,
    y1: ay + (dy / len) * padStart,
    x2: bx - (dx / len) * padEnd,
    y2: by - (dy / len) * padEnd,
  };
}

// Static default graph shown before any audit runs
const DEFAULT_GRAPH = {
  nodes: [
    { id: "age_group",                   label: "Age Group",           type: "protected" },
    { id: "socioeconomic_group",         label: "Socioeconomic Group", type: "protected" },
    { id: "college_graduation_year_gap", label: "Graduation Year Gap", type: "proxy" },
    { id: "employment_gap",              label: "Employment Gap",       type: "proxy" },
    { id: "neighborhood_quality",        label: "Neighbourhood",        type: "proxy" },
    { id: "test_score",                  label: "Test Score",           type: "legitimate" },
    { id: "experience_years",            label: "Experience",           type: "legitimate" },
    { id: "hired",                       label: "Hired",                type: "outcome" },
  ],
  edges: [
    { source: "age_group",                   target: "college_graduation_year_gap", type: "proxy",      strength: 0.34 },
    { source: "age_group",                   target: "employment_gap",              type: "proxy",      strength: 0.21 },
    { source: "socioeconomic_group",         target: "neighborhood_quality",        type: "proxy",      strength: 0.42 },
    { source: "college_graduation_year_gap", target: "hired",                       type: "proxy",      strength: 0.28 },
    { source: "employment_gap",              target: "hired",                       type: "proxy",      strength: 0.19 },
    { source: "neighborhood_quality",        target: "hired",                       type: "proxy",      strength: 0.31 },
    { source: "test_score",                  target: "hired",                       type: "legitimate", strength: 0.41 },
    { source: "experience_years",            target: "hired",                       type: "legitimate", strength: 0.31 },
  ],
};

export default function CausalGraph({ graphData }) {
  const data = graphData || DEFAULT_GRAPH;

  // Build position lookup
  const posMap = {};
  data.nodes.forEach(n => { posMap[n.id] = getPos(n.id); });

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      height="100%"
      style={{ display: "block" }}
      data-testid="causal-graph-svg"
    >
      <defs>
        {["proxy", "legitimate", "protected", "outcome"].map(t => {
          const color = t === "proxy" ? "#fb7185" : t === "legitimate" ? "#2dd4bf" : t === "protected" ? "#8b5cf6" : "#94a3b8";
          return (
            <marker key={t} id={`arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
            </marker>
          );
        })}
        <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Edges */}
      {data.edges.map((e, idx) => {
        const [ax, ay] = posMap[e.source] || [0, 0];
        const [bx, by] = posMap[e.target] || [0, 0];
        const pts = adjustEdge(ax, ay, bx, by);
        const mx = (pts.x1 + pts.x2) / 2;
        const my = (pts.y1 + pts.y2) / 2;
        const srcNode = data.nodes.find(n => n.id === e.source);
        const edgeType = e.type || srcNode?.type || "legitimate";
        const color = TYPE_COLORS[edgeType]?.edge || "#9aa0b9";
        const isProxy = edgeType === "proxy";

        return (
          <g key={idx}>
            <line
              x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
              stroke={color}
              strokeWidth={isProxy ? 2.5 : 1.8}
              strokeDasharray={isProxy ? "none" : "none"}
              markerEnd={`url(#arrow-${edgeType})`}
              opacity="0.85"
            />
            {/* Strength label */}
            <rect x={mx - 18} y={my - 11} width="36" height="22" rx="5"
              fill={isProxy ? "#3a0e16" : "#082822"}
              stroke={color} strokeOpacity="0.5" strokeWidth="1"
            />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize="11"
              fontFamily="'JetBrains Mono', monospace"
              fill={isProxy ? "#fecdd3" : "#99f6e4"}
            >
              {typeof e.strength === "number" ? e.strength.toFixed(2) : e.strength}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {data.nodes.map(n => {
        const [cx, cy] = posMap[n.id] || [VB_W / 2, VB_H / 2];
        const colors = TYPE_COLORS[n.type] || TYPE_COLORS.outcome;
        const Icon = ICON_MAP[n.id] || Users;
        // Shorten long labels
        const displayLabel = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label;

        return (
          <g key={n.id} className="graph-node" filter="url(#node-glow)">
            <circle cx={cx} cy={cy} r={RADIUS}
              fill={colors.fill} stroke={colors.stroke}
              strokeWidth="2" fillOpacity="0.95"
            />
            <foreignObject x={cx - 13} y={cy - 13} width="26" height="26">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "#fff" }}>
                <Icon size={20} />
              </div>
            </foreignObject>
            <text x={cx} y={cy + RADIUS + 17} textAnchor="middle" fontSize="12" fontWeight="500" fill="#e6e8f0">
              {displayLabel}
            </text>
            {n.type === "protected" && (
              <text x={cx} y={cy + RADIUS + 31} textAnchor="middle" fontSize="10" fill="#a48bff">
                (protected)
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
