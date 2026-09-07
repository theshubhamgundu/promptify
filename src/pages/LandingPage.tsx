/* ─────────────────────────────────────────────────────────────
   Promptify — Landing Page  (desktop fixed + mobile scrollable)
───────────────────────────────────────────────────────────── */

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  return (
    <>
      {/* ── MOBILE (< md) ────────────────────────────────────── */}
      <div
        className="md:hidden relative dot-bg"
        style={{ background: "#FAF7F2", minHeight: "100dvh" }}
      >
        <MobileBlobs />
        <MobileNav onEnter={onEnter} />
        <MobileHero onEnter={onEnter} />
        <MobileInfoCards />
        <MobileFooter />
      </div>

      {/* ── DESKTOP (md+) ────────────────────────────────────── */}
      <div
        className="hidden md:block relative w-full overflow-hidden dot-bg"
        style={{ background: "#FAF7F2", height: "100vh" }}
      >
        <Blobs />
        <Ornaments />
        <Navbar onEnter={onEnter} />
        <Stage onEnter={onEnter} />
        <BottomBar />
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   MOBILE COMPONENTS
════════════════════════════════════════════════════════════ */

/* ── Mobile blobs ───────────────────────────────────────────── */
function MobileBlobs() {
  return (
    <svg
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
      preserveAspectRatio="xMidYMid slice"
    >
      <ellipse cx="-20" cy="120" rx="180" ry="120" fill="#B57CFF" opacity="0.16" />
      <ellipse cx="110%" cy="75%" rx="180" ry="120" fill="#2FE69A" opacity="0.16" />
      <ellipse cx="50%" cy="40%" rx="200" ry="130" fill="#FFD027" opacity="0.1" />
    </svg>
  );
}

/* ── Mobile navbar ──────────────────────────────────────────── */
function MobileNav({ onEnter }: { onEnter: () => void }) {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "10px 16px",
        background: "#FAF7F2e0",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#FAF7F2",
          border: "2.5px solid #111111",
          borderRadius: 999,
          padding: "9px 14px",
          boxShadow: "4px 4px 0 #111111",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38, height: 38,
              background: "#FF5C00",
              border: "2px solid #111111",
              borderRadius: 11,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "2px 2px 0 #111111",
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: "#FAF7F2" }}>
              Pf
            </span>
          </div>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 20, color: "#111111" }}>
            Promptify<span style={{ color: "#FF5C00" }}>.</span>
          </span>
        </div>
        {/* Sign in */}
        <button
          onClick={onEnter}
          style={{
            fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 13,
            color: "#111111", background: "transparent",
            border: "2px solid #111111", borderRadius: 999,
            padding: "7px 16px", cursor: "pointer",
            boxShadow: "3px 3px 0 #111111",
          }}
        >
          Sign In
        </button>
      </div>
    </nav>
  );
}

/* ── Mobile hero ────────────────────────────────────────────── */
function MobileHero({ onEnter }: { onEnter: () => void }) {
  return (
    <div style={{ position: "relative", padding: "28px 20px 8px", zIndex: 10 }}>

      {/* Decorative ornaments */}
      <div className="anim-spin" style={{ position: "absolute", top: 24, right: 18, zIndex: 2 }}>
        <Starburst size={34} color="#FFD027" />
      </div>
      <div style={{ position: "absolute", top: 80, left: 6, zIndex: 2 }}>
        <StarShape size={20} color="#2FE69A" />
      </div>
      <div style={{ position: "absolute", bottom: 60, right: 8, zIndex: 2 }}>
        <StarShape size={16} color="#B57CFF" />
      </div>

      {/* Technique tags — horizontally scrollable */}
      <div
        style={{
          display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4,
          marginBottom: 18, scrollbarWidth: "none",
        }}
      >
        {[
          { label: "zero-shot", color: "#2FE69A" },
          { label: "few-shot", color: "#B57CFF" },
          { label: "chain-of-thought", color: "#FFD027" },
          { label: "RAG", color: "#FF5C00", fg: "#FAF7F2" },
          { label: "role-play", color: "#FAF7F2" },
        ].map(({ label, color, fg }) => (
          <span
            key={label}
            style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10,
              background: color, color: fg ?? "#111111",
              border: "1.5px solid #111111", borderRadius: 999,
              padding: "4px 12px", letterSpacing: "0.04em",
              boxShadow: "2px 2px 0 #11111130", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Badge */}
      <div
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20,
          background: "#FFD027", border: "2px solid #111111", borderRadius: 999,
          padding: "5px 14px", fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700, fontSize: 9.5, color: "#111111", letterSpacing: "0.05em",
          boxShadow: "3px 3px 0 #111111",
        }}
      >
        <span style={{ fontSize: 11 }}>⚡</span>
        <span>AI &amp; DATA EXCELLENCE CLUB PRESENTS</span>
      </div>

      {/* Headline */}
      <div style={{ marginBottom: 18, userSelect: "none" }}>
        <div
          className="headline-orange"
          style={{ fontSize: "clamp(50px, 13.5vw, 72px)", textShadow: "5px 5px 0 #111111" }}
        >
          PROMPT TO
        </div>
        <div
          className="headline-black"
          style={{ fontSize: "clamp(50px, 13.5vw, 72px)", textShadow: "5px 5px 0 #B57CFF" }}
        >
          REALITY
        </div>
      </div>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: 15,
          color: "#111111", lineHeight: 1.65, opacity: 0.82, marginBottom: 24,
        }}
      >
        Master AI communication. Turn prompts into code, art, and logic
        at a <strong style={{ fontWeight: 900 }}>prompt engineering event</strong>.
      </p>

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
        <button
          onClick={onEnter}
          className="btn-orange"
          style={{ justifyContent: "center", fontSize: 15, padding: "14px 24px" }}
        >
          <span>REGISTER SQUAD</span>
          <span style={{ fontSize: 16 }}>→</span>
        </button>
        <button
          onClick={onEnter}
          className="btn-ghost"
          style={{ justifyContent: "center", fontSize: 15, padding: "14px 24px" }}
        >
          VIEW RULES
        </button>
      </div>

      {/* Phase strip */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginBottom: 22, flexWrap: "wrap",
        }}
      >
        {["Design", "Engineer", "Deploy"].map((phase, i) => (
          <span key={phase} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                fontSize: 10, color: "#111111", opacity: 0.45, letterSpacing: "0.08em",
              }}
            >
              {String(i + 1).padStart(2, "0")} {phase}
            </span>
            {i < 2 && <span style={{ color: "#11111130", fontSize: 12 }}>—</span>}
          </span>
        ))}
      </div>

      {/* Prompt terminal */}
      <MobilePromptTerminal />

      {/* Decorative chip row */}
      <div
        style={{
          display: "flex", gap: 10, marginTop: 22,
          justifyContent: "center", flexWrap: "wrap",
        }}
      >
        {[
          { text: "[SYSTEM PROMPT]", bg: "#FF5C00", fg: "#FAF7F2", rot: "-2deg", delay: "0.4s" },
          { text: "temp: 0.9", bg: "#FFD027", fg: "#111111", rot: "2deg", delay: "0.9s" },
          { text: "top_p: 0.95", bg: "#B57CFF", fg: "#111111", rot: "-1.5deg", delay: "1.2s" },
        ].map(c => (
          <PromptChip key={c.text} text={c.text} bg={c.bg} fg={c.fg} rot={c.rot} delay={c.delay} />
        ))}
      </div>
    </div>
  );
}

/* ── Mobile prompt terminal (compact) ───────────────────────── */
function MobilePromptTerminal() {
  return (
    <div
      style={{
        background: "#0D1117", border: "2.5px solid #111111", borderRadius: 14,
        overflow: "hidden", textAlign: "left", boxShadow: "5px 5px 0 #111111",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#161b22", borderBottom: "1.5px solid #30363d",
          padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
        }}
      >
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%", background: "#2FE69A",
            display: "inline-block", boxShadow: "0 0 6px #2FE69A", flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
            color: "#8b949e", fontWeight: 700,
          }}
        >
          promptify-engine v2.6
        </span>
        <span
          style={{
            marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            color: "#B57CFF", background: "#1f1030", padding: "2px 7px",
            borderRadius: 4, border: "1px solid #3d1f6e", fontWeight: 700, whiteSpace: "nowrap",
          }}
        >
          temp: 0.8
        </span>
      </div>

      {/* System */}
      <div
        style={{
          padding: "8px 14px", borderBottom: "1px solid #21262d",
          display: "flex", gap: 8, alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            color: "#FFD027", fontWeight: 700, flexShrink: 0, marginTop: 1,
          }}
        >
          SYS
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6e7681", lineHeight: 1.5 }}>
          You are a world-class prompt engineer competing at Promptify 2026.
        </span>
      </div>

      {/* User */}
      <div
        style={{
          padding: "8px 14px", borderBottom: "1px solid #21262d",
          display: "flex", gap: 8, alignItems: "flex-start",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            color: "#FF5C00", fontWeight: 700, flexShrink: 0, marginTop: 1,
          }}
        >
          USR
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#c9d1d9", lineHeight: 1.5 }}>
          Design a zero-shot prompt that turns a vague idea into production-ready output.
        </span>
      </div>

      {/* Assistant */}
      <div style={{ padding: "8px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
            color: "#2FE69A", fontWeight: 700, flexShrink: 0, marginTop: 1,
          }}
        >
          AST
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8b949e", lineHeight: 1.5 }}>
          {"Structuring role → task → format → constraints..."}
          <span
            style={{
              display: "inline-block", width: 6, height: 11, background: "#2FE69A",
              marginLeft: 3, verticalAlign: "middle",
              animation: "blink 1.1s step-start infinite",
            }}
          />
        </span>
      </div>
    </div>
  );
}

/* ── Mobile info cards ──────────────────────────────────────── */
function MobileInfoCards() {
  const cards = [
    { icon: "📅", label: "DATE", value: "TBA", bg: "#2FE69A" },
    { icon: "📍", label: "VENUE", value: "VITS ,HYDERABAD", bg: "#B57CFF" },
    { icon: "🏆", label: "PRIZES", value: "TBA", bg: "#FFD027" },
  ];
  return (
    <div style={{ padding: "24px 20px 8px", display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 10 }}>
      {cards.map(c => (
        <div
          key={c.label}
          style={{
            display: "flex", alignItems: "center", gap: 14,
            background: c.bg, border: "2.5px solid #111111",
            borderRadius: 16, padding: "14px 18px",
            boxShadow: "4px 4px 0 #111111",
          }}
        >
          <span style={{ fontSize: 26, lineHeight: 1 }}>{c.icon}</span>
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                fontSize: 9, letterSpacing: "0.14em", color: "#111111",
                opacity: 0.55, marginBottom: 2,
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontFamily: "'Nunito', sans-serif", fontWeight: 900,
                fontSize: 16, color: "#111111",
              }}
            >
              {c.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Mobile footer ──────────────────────────────────────────── */
function MobileFooter() {
  return (
    <div
      style={{
        padding: "24px 20px 36px", textAlign: "center",
        position: "relative", zIndex: 10,
      }}
    >
      {/* Params panel — centered */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <ParamsPanel />
      </div>
      <p
        style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
          color: "#111111", opacity: 0.35, letterSpacing: "0.06em",
        }}
      >
        © 2026 AI &amp; Data Excellence Club
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DESKTOP COMPONENTS  (unchanged from original)
════════════════════════════════════════════════════════════ */

/* ── Blobs ──────────────────────────────────────────────────── */
function Blobs() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
      <ellipse cx="-40" cy="80" rx="220" ry="140" fill="#B57CFF" opacity="0.18" />
      <ellipse cx="1480" cy="870" rx="260" ry="160" fill="#2FE69A" opacity="0.2" />
      <ellipse cx="720" cy="430" rx="340" ry="200" fill="#FFD027" opacity="0.12" />
    </svg>
  );
}

/* ── Ornaments ──────────────────────────────────────────────── */
function Ornaments() {
  return (
    <>
      <div className="absolute anim-spin" style={{ top: 72, right: 148, zIndex: 2 }}>
        <Starburst size={56} color="#FFD027" />
      </div>
      <div className="absolute" style={{ left: 228, top: 148, zIndex: 2 }}>
        <StarShape size={28} color="#2FE69A" />
      </div>
      <div className="absolute" style={{ right: 240, bottom: 130, zIndex: 2 }}>
        <StarShape size={22} color="#B57CFF" />
      </div>
      <div className="absolute" style={{ left: 190, bottom: 100, zIndex: 2 }}>
        <StarShape size={18} color="#FF5C00" />
      </div>
      <svg className="absolute" style={{ left: 260, top: 380, zIndex: 1, opacity: 0.35 }} width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r="22" stroke="#111111" strokeWidth="2.5" strokeDasharray="5 4" fill="none" />
      </svg>
      <svg className="absolute" style={{ right: 255, bottom: 170, opacity: 0.3, zIndex: 1 }} width="68" height="32" viewBox="0 0 68 32">
        <polyline points="2,16 12,4 22,28 32,4 42,28 52,4 66,16" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    </>
  );
}

/* ── Navbar ─────────────────────────────────────────────────── */
function Navbar({ onEnter }: { onEnter: () => void }) {
  return (
    <nav className="absolute top-5 inset-x-0 flex justify-center px-10" style={{ zIndex: 50 }}>
      <div
        className="flex items-center justify-between w-full shadow-hard"
        style={{
          maxWidth: 1180,
          background: "#FAF7F2",
          border: "2.5px solid #111111",
          borderRadius: 999,
          padding: "14px 22px",
        }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="flex items-center justify-center shadow-hard-sm"
            style={{
              width: 56, height: 56,
              background: "#FF5C00",
              border: "2.5px solid #111111",
              borderRadius: 16,
              flexShrink: 0,
            }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 19, color: "#FAF7F2", letterSpacing: "-0.02em" }}>
              Pf
            </span>
          </div>
          <span style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 26, color: "#111111" }}>
            Promptify<span style={{ color: "#FF5C00" }}>.</span>
          </span>
        </div>

        <div className="flex items-center gap-14">
          {["About", "Challenges", "Prizes"].map(link => (
            <a
              key={link}
              href="#"
              style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 22, color: "#111111", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#FF5C00")}
              onMouseLeave={e => (e.currentTarget.style.color = "#111111")}
            >
              {link}
            </a>
          ))}
        </div>

        <button onClick={onEnter} className="btn-ghost" style={{ padding: "13px 34px", fontSize: 18 }}>
          Sign In
        </button>
      </div>
    </nav>
  );
}

/* ── Parameters mini-panel ──────────────────────────────────── */
function ParamsPanel() {
  const params = [
    { key: "model", val: "claude-3-5", color: "#B57CFF" },
    { key: "strategy", val: "zero-shot", color: "#2FE69A" },
    { key: "format", val: "markdown", color: "#FFD027" },
  ];
  return (
    <div
      style={{
        background: "#111111",
        border: "2.5px solid #111111",
        borderRadius: 12,
        boxShadow: "4px 4px 0 #B57CFF",
        overflow: "hidden",
        minWidth: 170,
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderBottom: "1px solid #333",
          padding: "5px 10px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "#555",
          fontWeight: 700,
          letterSpacing: "0.1em",
        }}
      >
        PROMPT PARAMS
      </div>
      {params.map(({ key, val, color }) => (
        <div
          key={key}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "5px 10px",
            borderBottom: "1px solid #1e1e1e",
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#555", fontWeight: 700 }}>
            {key}
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color,
              fontWeight: 700,
              background: `${color}18`,
              padding: "1px 6px",
              borderRadius: 4,
            }}
          >
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Stage (3-col layout) ───────────────────────────────────── */
function Stage({ onEnter }: { onEnter: () => void }) {
  return (
    <div
      className="absolute inset-0 grid"
      style={{
        gridTemplateColumns: "280px 1fr 280px",
        paddingTop: 90,
        paddingBottom: 90,
        paddingLeft: 40,
        paddingRight: 40,
        zIndex: 10,
        gap: 40,
      }}
    >
      {/* Left mascot column */}
      <div className="relative flex flex-col items-center justify-center gap-5" style={{ zIndex: 5, maxWidth: "280px", overflow: "hidden" }}>
        <div className="anim-bob" style={{ transform: "scale(1.1)", transformOrigin: "center center" }}>
          <RetroTerminal />
        </div>
        <PromptChip text="[SYSTEM PROMPT]" bg="#FF5C00" fg="#FAF7F2" rot="-5deg" delay="0.4s" size="lg" />
        <PromptChip text="temperature: 0.9" bg="#FFD027" fg="#111111" rot="3deg" delay="1.0s" size="lg" />
        <PromptChip text="few-shot: 3" bg="#2FE69A" fg="#111111" rot="-3deg" delay="0.7s" />
        <PromptChip text="top_p: 0.95" bg="#FAF7F2" fg="#111111" rot="4deg" delay="1.5s" />
      </div>

      {/* Centre hero */}
      <HeroCenter onEnter={onEnter} />

      {/* Right mascot column */}
      <div className="relative flex flex-col items-center justify-center gap-4" style={{ zIndex: 5, maxWidth: "280px", overflow: "hidden" }}>
        <div className="anim-bob-alt">
          <MagicWand />
        </div>
        <PromptChip text="--chaos 50" bg="#B57CFF" fg="#111111" rot="4deg" delay="0.7s" />
        <PromptChip text="chain-of-thought" bg="#2FE69A" fg="#111111" rot="-3deg" delay="1.3s" />
        <PromptChip text="context: 128k" bg="#FF5C00" fg="#FAF7F2" rot="3deg" delay="0.9s" />
        <ParamsPanel />
      </div>
    </div>
  );
}

/* ── Hero centre ────────────────────────────────────────────── */
function HeroCenter({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4" style={{ position: "relative", zIndex: 20 }}>

      {/* Technique tags row */}
      <div className="flex items-center gap-2 mb-4" style={{ position: "relative", zIndex: 20 }}>
        {[
          { label: "zero-shot", color: "#2FE69A" },
          { label: "few-shot", color: "#B57CFF" },
          { label: "chain-of-thought", color: "#FFD027" },
          { label: "RAG", color: "#FF5C00", fg: "#FAF7F2" },
        ].map(({ label, color, fg }) => (
          <span
            key={label}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: 10,
              background: color,
              color: fg ?? "#111111",
              border: "1.5px solid #111111",
              borderRadius: 999,
              padding: "3px 10px",
              letterSpacing: "0.04em",
              boxShadow: "2px 2px 0 #11111130",
              position: "relative",
              zIndex: 20,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Pill badge */}
      <div
        className="flex items-center gap-2 mb-5 shadow-hard-sm"
        style={{
          background: "#FFD027",
          border: "2px solid #111111",
          borderRadius: 999,
          padding: "6px 18px",
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          fontSize: 12,
          color: "#111111",
          letterSpacing: "0.06em",
          position: "relative",
          zIndex: 20,
        }}
      >
        <span style={{ fontSize: 14 }}>⚡</span>
        <span>AI &amp; DATA EXCELLENCE CLUB PRESENTS</span>
      </div>

      {/* Headline */}
      <div className="mb-5 select-none" style={{ position: "relative", zIndex: 20 }}>
        <div className="headline-orange" style={{ fontSize: 134, position: "relative", zIndex: 20 }}>PROMPT TO</div>
        <div className="headline-black" style={{ fontSize: 134, position: "relative", zIndex: 20 }}>REALITY</div>
      </div>

      {/* Subtitle */}
      <p
        className="mb-6"
        style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 600,
          fontSize: 17,
          color: "#111111",
          lineHeight: 1.65,
          maxWidth: 460,
          opacity: 0.82,
          position: "relative",
          zIndex: 20,
        }}
      >
        Master AI communication. Turn prompts into code, art, and logic
        at a <strong style={{ fontWeight: 900 }}>prompt engineering event</strong>.
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-4" style={{ position: "relative", zIndex: 20 }}>
        <button onClick={onEnter} className="btn-orange">
          <span>REGISTER SQUAD</span>
          <span style={{ fontSize: 16 }}>→</span>
        </button>
        <button onClick={onEnter} className="btn-ghost">
          VIEW RULES
        </button>
      </div>

      {/* Phase strip */}
      <div className="flex items-center gap-2 mt-5" style={{ position: "relative", zIndex: 20 }}>
        {["Design", "Engineer", "Deploy"].map((phase, i) => (
          <span key={phase} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: 11,
                color: "#111111",
                opacity: 0.5,
                letterSpacing: "0.08em",
              }}
            >
              {String(i + 1).padStart(2, "0")} {phase}
            </span>
            {i < 2 && (
              <span style={{ color: "#11111128", fontSize: 14, fontWeight: 300 }}>—</span>
            )}
          </span>
        ))}
      </div>

      {/* Mini prompt terminal */}
      <PromptTerminal />
    </div>
  );
}

/* ── Desktop prompt terminal ────────────────────────────────── */
function PromptTerminal() {
  return (
    <div
      className="shadow-hard"
      style={{
        marginTop: 16,
        width: "100%",
        maxWidth: 450,
        background: "#0D1117",
        border: "2.5px solid #111111",
        borderRadius: 14,
        overflow: "hidden",
        textAlign: "left",
      }}
    >
      <div
        style={{
          background: "#161b22",
          borderBottom: "1.5px solid #30363d",
          padding: "7px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#2FE69A", display: "inline-block", boxShadow: "0 0 6px #2FE69A" }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8b949e", fontWeight: 700 }}>
            promptify-engine v2.6
          </span>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {["temp: 0.8", "top_p: 0.95", "max_tokens: 2048"].map(p => (
            <span
              key={p}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, color: "#B57CFF", background: "#1f1030",
                padding: "2px 7px", borderRadius: 4, fontWeight: 700,
                border: "1px solid #3d1f6e",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "7px 14px", borderBottom: "1px solid #21262d", display: "flex", gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#FFD027", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>SYSTEM</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6e7681" }}>
          You are a world-class prompt engineer competing at Promptify 2026.
        </span>
      </div>

      <div style={{ padding: "7px 14px", borderBottom: "1px solid #21262d", display: "flex", gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#FF5C00", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>USER</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#c9d1d9" }}>
          Design a zero-shot prompt that turns a vague idea into production-ready output.
        </span>
      </div>

      <div style={{ padding: "7px 14px", display: "flex", gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#2FE69A", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>ASST</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8b949e" }}>
          {"Structuring role → task → format → constraints..."}
          <span
            style={{
              display: "inline-block", width: 7, height: 11, background: "#2FE69A",
              marginLeft: 3, verticalAlign: "middle",
              animation: "blink 1.1s step-start infinite",
            }}
          />
        </span>
      </div>
    </div>
  );
}

/* ── Bottom bar ─────────────────────────────────────────────── */
function BottomBar() {
  const cards = [
    { icon: "📅", label: "DATE", value: "TBA", bg: "#2FE69A" },
    { icon: "📍", label: "VENUE", value: "VITS ,HYDERABAD", bg: "#B57CFF" },
    { icon: "🏆", label: "PRIZES", value: "TBA", bg: "#FFD027" },
  ];
  return (
    <div className="absolute bottom-5 inset-x-0 flex justify-center px-10" style={{ zIndex: 30 }}>
      <div className="flex gap-4 w-full" style={{ maxWidth: 860 }}>
        {cards.map(c => (
          <div
            key={c.label}
            className="flex-1 flex items-center gap-4 shadow-hard"
            style={{
              background: c.bg, border: "2.5px solid #111111",
              borderRadius: 18, padding: "12px 22px",
            }}
          >
            <span style={{ fontSize: 26, lineHeight: 1 }}>{c.icon}</span>
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
                  fontSize: 9, letterSpacing: "0.14em", color: "#111111",
                  opacity: 0.55, marginBottom: 1,
                }}
              >
                {c.label}
              </div>
              <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 900, fontSize: 16, color: "#111111" }}>
                {c.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SHARED PRIMITIVES
════════════════════════════════════════════════════════════ */

/* ── Prompt chip pill ───────────────────────────────────────── */
function PromptChip({
  text, bg, fg, rot, delay, size = "sm",
}: {
  text: string; bg: string; fg: string; rot: string; delay: string; size?: "sm" | "lg";
}) {
  const lg = size === "lg";
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        fontSize: lg ? 15 : 12,
        background: bg,
        color: fg,
        border: `${lg ? 2.5 : 2}px solid #111111`,
        borderRadius: 999,
        padding: lg ? "9px 20px" : "6px 14px",
        boxShadow: lg ? "4px 4px 0 #111111" : "3px 3px 0 #111111",
        whiteSpace: "nowrap",
        transform: `rotate(${rot})`,
        animation: `bob 3.5s ease-in-out ${delay} infinite`,
      }}
    >
      {text}
    </div>
  );
}

/* ── Retro Terminal mascot ──────────────────────────────────── */
function RetroTerminal() {
  return (
    <svg width="170" height="210" viewBox="0 0 170 210" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="6" width="158" height="168" rx="18" fill="#FAF7F2" stroke="#111111" strokeWidth="4" />
      <rect x="18" y="18" width="134" height="96" rx="10" fill="#111111" />
      <rect x="22" y="22" width="126" height="88" rx="7" fill="#0D1117" />
      <rect x="28" y="36" width="76" height="5" rx="2.5" fill="#2FE69A" opacity="0.85" />
      <rect x="28" y="50" width="54" height="5" rx="2.5" fill="#2FE69A" opacity="0.55" />
      <rect x="28" y="64" width="64" height="5" rx="2.5" fill="#2FE69A" opacity="0.3" />
      <rect x="28" y="78" width="40" height="5" rx="2.5" fill="#2FE69A" opacity="0.2" />
      <rect x="110" y="35" width="11" height="14" rx="2" fill="#2FE69A" style={{ animation: "blink 1.1s step-start infinite" }} />
      <text x="28" y="47" fontFamily="monospace" fontSize="12" fill="#2FE69A" opacity="0.9">&gt;_ prompt</text>
      <circle cx="33" cy="28" r="4" fill="#FF5C55" stroke="#111111" strokeWidth="1.5" />
      <circle cx="47" cy="28" r="4" fill="#FFD027" stroke="#111111" strokeWidth="1.5" />
      <circle cx="61" cy="28" r="4" fill="#2FE69A" stroke="#111111" strokeWidth="1.5" />
      <circle cx="55" cy="136" r="16" fill="white" stroke="#111111" strokeWidth="3" />
      <circle cx="115" cy="136" r="16" fill="white" stroke="#111111" strokeWidth="3" />
      <circle cx="58" cy="138" r="7" fill="#111111" />
      <circle cx="118" cy="138" r="7" fill="#111111" />
      <circle cx="61" cy="135" r="2.5" fill="white" />
      <circle cx="121" cy="135" r="2.5" fill="white" />
      <path d="M62 158 Q85 172 108 158" stroke="#111111" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="42" cy="152" rx="10" ry="6" fill="#FF5C00" opacity="0.25" />
      <ellipse cx="128" cy="152" rx="10" ry="6" fill="#FF5C00" opacity="0.25" />
      <rect x="18" y="174" width="134" height="16" rx="6" fill="#E8E4DE" stroke="#111111" strokeWidth="2.5" />
      {[28, 44, 60, 76, 92, 108, 124, 140].map(x => (
        <rect key={x} x={x} y="177" width="10" height="7" rx="2" fill="#D0CCCA" stroke="#111111" strokeWidth="1" />
      ))}
      <line x1="85" y1="6" x2="85" y2="-12" stroke="#111111" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="85" cy="-16" r="7" fill="#FF5C00" stroke="#111111" strokeWidth="3" />
      {[40, 54, 68].map(y => (
        <line key={y} x1="6" y1={y + 120} x2="14" y2={y + 120} stroke="#111111" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/* ── Magic Wand mascot ──────────────────────────────────────── */
function MagicWand() {
  return (
    <svg width="140" height="200" viewBox="0 0 140 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="56" y="80" width="20" height="105" rx="10" fill="#FAF7F2" stroke="#111111" strokeWidth="3.5" transform="rotate(-22 66 132)" />
      {[94, 110, 126].map((y, i) => (
        <rect key={i} x="54" y={y} width="24" height="7" rx="3.5"
          fill={i === 1 ? "#B57CFF" : "#FFD027"} stroke="#111111" strokeWidth="2"
          transform="rotate(-22 66 132)"
        />
      ))}
      <polygon points="66,8 71,24 88,24 75,34 80,50 66,40 52,50 57,34 44,24 61,24" fill="#FFD027" stroke="#111111" strokeWidth="3" />
      <text x="92" y="30" fontSize="20" fill="#FF5C00">✦</text>
      <text x="16" y="60" fontSize="14" fill="#B57CFF">✦</text>
      <text x="100" y="68" fontSize="11" fill="#2FE69A">✦</text>
      <text x="28" y="34" fontSize="9" fill="#FFD027">✦</text>
      <text x="108" y="50" fontSize="8" fill="#FF5C00">✦</text>
      <circle cx="110" cy="80" r="4" fill="#B57CFF" stroke="#111111" strokeWidth="1.5" />
      <circle cx="24" cy="78" r="3" fill="#2FE69A" stroke="#111111" strokeWidth="1.5" />
      <circle cx="118" cy="110" r="2.5" fill="#FFD027" stroke="#111111" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Starburst shape ────────────────────────────────────────── */
function Starburst({ size, color }: { size: number; color: string }) {
  const R = size / 2;
  const r = R * 0.48;
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * Math.PI) / 8 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    return `${R + rad * Math.cos(angle)},${R + rad * Math.sin(angle)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={points} fill={color} stroke="#111111" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Small star ─────────────────────────────────────────────── */
function StarShape({ size, color }: { size: number; color: string }) {
  const c = size / 2;
  const R = c;
  const r = c * 0.42;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    return `${c + rad * Math.cos(a)},${c + rad * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polygon points={pts} fill={color} stroke="#111111" strokeWidth="2" />
    </svg>
  );
}
