import React from "react";
import {
  Home,
  ShieldCheck,
  Share2,
  CheckCircle2,
  FileText,
  Database,
  Settings as SettingsIcon,
  ShieldHalf,
} from "lucide-react";

const items = [
  { id: "overview", label: "Overview", Icon: Home },
  { id: "fairness-audit", label: "Fairness Audit", Icon: ShieldCheck },
  { id: "causal-graph", label: "Causal Graph", Icon: Share2 },
  { id: "debiasing", label: "Debiasing", Icon: CheckCircle2 },
  { id: "reports", label: "Reports", Icon: FileText },
  { id: "dataset", label: "Dataset", Icon: Database },
  { id: "settings", label: "Settings", Icon: SettingsIcon },
];

export default function Sidebar({ active = "overview", onChange = () => {} }) {
  return (
    <aside
      data-testid="sidebar"
      className="sidebar"
      style={{
        width: 232,
        flexShrink: 0,
        padding: "26px 18px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div>
        {/* Logo */}
        <div
          data-testid="sidebar-logo"
          style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 6px 28px" }}
        >
          <div className="logo-box">A</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Aition</div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map(({ id, label, Icon }) => (
            <div
              key={id}
              data-testid={`nav-${id}`}
              className={`nav-item ${active === id ? "active" : ""}`}
              onClick={() => onChange(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom Tagline */}
      <div className="mini-card" data-testid="sidebar-tagline">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
          <div>
            <div style={{ color: "#b9a4ff", fontWeight: 600, fontSize: 13.5, lineHeight: 1.35 }}>
              Causal AI for<br />Fair Decisions
            </div>
            <div style={{ marginTop: 10, color: "#8a8fa8", fontSize: 11.5, lineHeight: 1.5 }}>
              Detect. Understand.<br />Debias.
            </div>
          </div>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(124, 92, 255, 0.16)",
              border: "1px solid rgba(124, 92, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#b9a4ff",
            }}
          >
            <ShieldHalf size={15} />
          </div>
        </div>
      </div>
    </aside>
  );
}
