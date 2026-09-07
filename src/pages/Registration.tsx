/* ═════════════════════════════════════════════════════════════════
   Team Registration Page — Promptify 2026
   - Team of 2 members
   - VITS: Branch + Section required
   - VFSTR: Only Roll Number required
   - Email validation: @gmail.com or @vignanits.ac.in
   - Auto-generate team code: AIDX + 4 digits
═════════════════════════════════════════════════════════════════ */

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ArrowLeft, CheckCircle, Mail, Hash, Building, Phone } from "lucide-react";

interface RegistrationProps {
  onBack: () => void;
}

type College = "VITS" | "VFSTR";

interface TeamMember {
  name: string;
  email: string;
  phone: string;
  rollNumber: string;
  year: string;
  branch: string;
  section: string;
}

export default function Registration({ onBack }: RegistrationProps) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


  const [college, setCollege] = useState<College>("VITS");
  
  const [member1, setMember1] = useState<TeamMember>({
    name: "",
    email: "",
    phone: "",
    rollNumber: "",
    year: "",
    branch: "",
    section: "",
  });
  
  const [member2, setMember2] = useState<TeamMember>({
    name: "",
    email: "",
    phone: "",
    rollNumber: "",
    year: "",
    branch: "",
    section: "",
  });

  const [teamCode, setTeamCode] = useState("");

  const branches = ["AI&DS", "AIML", "CSE", "CSM", "IT", "ECE", "EEE", "MECH", "CIVIL"];
  const sections = ["A", "B", "C", "D"];
  const years = ["1", "2", "3", "4"];

  const validateEmail = (email: string) => {
    const regex = /^[A-Za-z0-9._%+-]+@(gmail\.com|vignanits\.ac\.in)$/;
    return regex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation

    if (!member1.name.trim() || !member2.name.trim()) {
      setError("Please enter names for both members");
      setLoading(false);
      return;
    }

    if (!validateEmail(member1.email) || !validateEmail(member2.email)) {
      setError("Email must be @gmail.com or @vignanits.ac.in");
      setLoading(false);
      return;
    }

    if (member1.email === member2.email) {
      setError("Both members must have different email addresses");
      setLoading(false);
      return;
    }

    if (!member1.phone.trim() || !member2.phone.trim() || !/^\d{10}$/.test(member1.phone.trim()) || !/^\d{10}$/.test(member2.phone.trim())) {
      setError("Please enter valid 10-digit contact numbers for both members");
      setLoading(false);
      return;
    }

    if (!member1.rollNumber.trim() || !member2.rollNumber.trim()) {
      setError("Please enter roll numbers for both members");
      setLoading(false);
      return;
    }

    if (!member1.year || !member2.year) {
      setError("Please select year for both members");
      setLoading(false);
      return;
    }

    // VITS validation
    if (college === "VITS") {
      if (!member1.branch || !member2.branch) {
        setError("Please select branch for both members");
        setLoading(false);
        return;
      }
      if (!member1.section || !member2.section) {
        setError("Please select section for both members");
        setLoading(false);
        return;
      }
    }

    try {
      const { data, error: registerError } = await supabase.rpc("register_team", {
        p_team_name: `${member1.name} & ${member2.name}`,
        p_member1_name: member1.name,
        p_member1_email: member1.email,
        p_member1_phone: member1.phone,
        p_member1_roll: member1.rollNumber,
        p_member1_year: member1.year,
        p_member1_branch: college === "VITS" ? member1.branch : null,
        p_member1_section: college === "VITS" ? member1.section : null,
        p_member1_college: college,
        p_member2_name: member2.name,
        p_member2_email: member2.email,
        p_member2_phone: member2.phone,
        p_member2_roll: member2.rollNumber,
        p_member2_year: member2.year,
        p_member2_branch: college === "VITS" ? member2.branch : null,
        p_member2_section: college === "VITS" ? member2.section : null,
        p_member2_college: college,
      });

      if (registerError) throw registerError;

      if (!data.success) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      setTeamCode(data.teamCode);
      setStep("success");
    } catch (err: any) {
      console.error("Registration error:", err);
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen dot-bg flex items-center justify-center p-4" style={{ background: "#FAF7F2" }}>
        <div
          className="shadow-hard"
          style={{
            maxWidth: 580,
            width: "100%",
            background: "#FAF7F2",
            border: "2.5px solid #111111",
            borderRadius: 20,
            padding: "48px 40px",
            textAlign: "center",
          }}
        >
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div
              className="shadow-hard"
              style={{
                width: 80,
                height: 80,
                background: "#2FE69A",
                border: "2.5px solid #111111",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle size={40} strokeWidth={2.5} color="#111111" />
            </div>
          </div>

          {/* Success Message */}
          <h2
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 900,
              fontSize: 32,
              color: "#111111",
              marginBottom: 16,
            }}
          >
            Registration Successful!
          </h2>

          <p
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              color: "#111111",
              opacity: 0.7,
              marginBottom: 32,
              lineHeight: 1.6,
            }}
          >
            Your team has been registered for Promptify 2026!
          </p>

          {/* Team Code Display */}
          <div
            className="shadow-hard"
            style={{
              background: "#FFD027",
              border: "2.5px solid #111111",
              borderRadius: 14,
              padding: "24px",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                color: "#111111",
                opacity: 0.6,
                marginBottom: 8,
                letterSpacing: "0.1em",
              }}
            >
              YOUR TEAM CODE
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 48,
                fontWeight: 900,
                color: "#111111",
                letterSpacing: "0.08em",
              }}
            >
              {teamCode}
            </div>
          </div>

          {/* Instructions */}
          <div
            style={{
              background: "#FAF7F2",
              border: "2px solid #111111",
              borderRadius: 12,
              padding: "20px",
              marginBottom: 24,
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <Mail size={20} color="#FF5C00" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111111",
                    marginBottom: 4,
                  }}
                >
                  Check your email
                </p>
                <p
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#111111",
                    opacity: 0.65,
                    lineHeight: 1.5,
                  }}
                >
                  A confirmation email has been sent to <strong>{member1.email}</strong>
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <Hash size={20} color="#B57CFF" strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <p
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#111111",
                    marginBottom: 4,
                  }}
                >
                  Save your team code
                </p>
                <p
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#111111",
                    opacity: 0.65,
                    lineHeight: 1.5,
                  }}
                >
                  You'll receive your password one day before the event. Use your team code to login.
                </p>
              </div>
            </div>
          </div>

          {/* Back to Home */}
          <button
            onClick={onBack}
            className="btn-orange"
            style={{
              width: "100%",
              justifyContent: "center",
              fontSize: 16,
              padding: "16px",
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dot-bg" style={{ position: "fixed", inset: 0, background: "#FAF7F2", overflowY: "auto", padding: "32px 16px", zIndex: 50 }}>
      <div
        className="shadow-hard"
        style={{
          maxWidth: 720,
          width: "100%",
          background: "#FAF7F2",
          border: "2.5px solid #111111",
          borderRadius: 20,
          overflow: "hidden",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#FF5C00",
            borderBottom: "2.5px solid #111111",
            padding: "24px 32px",
            position: "relative",
          }}
        >
          <button
            onClick={onBack}
            style={{
              position: "absolute",
              left: 24,
              top: "50%",
              transform: "translateY(-50%)",
              background: "#FAF7F2",
              border: "2px solid #111111",
              borderRadius: "50%",
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "3px 3px 0 #111111",
            }}
          >
            <ArrowLeft size={20} strokeWidth={2.5} color="#111111" />
          </button>

          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 900,
                fontSize: 28,
                color: "#FAF7F2",
                marginBottom: 8,
              }}
            >
              Team Registration
            </h1>
            <p
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: "#FAF7F2",
                opacity: 0.9,
              }}
            >
              Promptify 2026 — AI & Data Excellence Club
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "32px" }}>

          {/* College Selection */}
          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 800,
                fontSize: 14,
                color: "#111111",
                display: "block",
                marginBottom: 8,
              }}
            >
              <Building size={16} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              College
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              {(["VITS", "VFSTR"] as College[]).map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setCollege(col)}
                  style={{
                    flex: 1,
                    fontFamily: "'Nunito', sans-serif",
                    fontWeight: 800,
                    fontSize: 15,
                    padding: "14px",
                    border: "2px solid #111111",
                    borderRadius: 10,
                    background: college === col ? "#FFD027" : "#FAF7F2",
                    color: "#111111",
                    cursor: "pointer",
                    boxShadow: "3px 3px 0 #111111",
                  }}
                >
                  {col}
                </button>
              ))}
            </div>
          </div>

          {/* Member 1 */}
          <MemberForm
            memberNumber={1}
            member={member1}
            setMember={setMember1}
            college={college}
            branches={branches}
            sections={sections}
            years={years}
          />

          {/* Member 2 */}
          <MemberForm
            memberNumber={2}
            member={member2}
            setMember={setMember2}
            college={college}
            branches={branches}
            sections={sections}
            years={years}
          />

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#FFE5E5",
                border: "2px solid #FF5C00",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 20,
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                color: "#FF5C00",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-orange"
            style={{
              width: "100%",
              justifyContent: "center",
              fontSize: 16,
              padding: "16px",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Registering..." : "Register Team"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Member Form Component
══════════════════════════════════════════════════════════════ */
interface MemberFormProps {
  memberNumber: number;
  member: TeamMember;
  setMember: React.Dispatch<React.SetStateAction<TeamMember>>;
  college: College;
  branches: string[];
  sections: string[];
  years: string[];
}

function MemberForm({ memberNumber, member, setMember, college, branches, sections, years }: MemberFormProps) {
  return (
    <div
      className="shadow-hard"
      style={{
        background: memberNumber === 1 ? "#2FE69A20" : "#B57CFF20",
        border: "2px solid #111111",
        borderRadius: 14,
        padding: "20px",
        marginBottom: 24,
      }}
    >
      <h3
        style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900,
          fontSize: 18,
          color: "#111111",
          marginBottom: 16,
        }}
      >
        Member {memberNumber}
      </h3>

      {/* Name */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#111111",
            display: "block",
            marginBottom: 6,
          }}
        >
          Full Name *
        </label>
        <input
          type="text"
          value={member.name}
          onChange={(e) => setMember({ ...member, name: e.target.value })}
          placeholder="Enter full name"
          required
          style={{
            width: "100%",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            padding: "12px 14px",
            border: "2px solid #111111",
            borderRadius: 8,
            outline: "none",
            background: "#FAF7F2",
          }}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#111111",
            display: "block",
            marginBottom: 6,
          }}
        >
          Email *
        </label>
        <div style={{ display: "flex", gap: 0 }}>
          <input
            type="text"
            value={member.email.split("@")[0] || ""}
            onChange={(e) => {
              const username = e.target.value.replace(/[@\s]/g, "");
              const domain = member.email.includes("@") ? member.email.split("@")[1] : "gmail.com";
              setMember({ ...member, email: username ? `${username}@${domain}` : "" });
            }}
            placeholder="Enter your email"
            required
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              padding: "12px 14px",
              border: "2px solid #111111",
              borderRight: "none",
              borderRadius: "8px 0 0 8px",
              outline: "none",
              background: "#FAF7F2",
            }}
          />
          <select
            value={member.email.includes("@") ? member.email.split("@")[1] : "gmail.com"}
            onChange={(e) => {
              const username = member.email.split("@")[0] || "";
              setMember({ ...member, email: username ? `${username}@${e.target.value}` : "" });
            }}
            style={{
              fontFamily: "'Nunito', sans-serif",
              fontWeight: 700,
              fontSize: 13,
              padding: "12px 10px",
              border: "2px solid #111111",
              borderRadius: "0 8px 8px 0",
              outline: "none",
              background: "#FFD027",
              color: "#111111",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <option value="gmail.com">@gmail.com</option>
            <option value="vignanits.ac.in">@vignanits.ac.in</option>
          </select>
        </div>
      </div>

      {/* Contact Number */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#111111",
            display: "block",
            marginBottom: 6,
          }}
        >
          <Phone size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} />
          Contact Number * <span style={{ fontSize: 11, opacity: 0.6 }}>(10 digits)</span>
        </label>
        <input
          type="tel"
          value={member.phone}
          onChange={(e) => setMember({ ...member, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
          placeholder="Enter 10-digit mobile number"
          required
          maxLength={10}
          style={{
            width: "100%",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            padding: "12px 14px",
            border: "2px solid #111111",
            borderRadius: 8,
            outline: "none",
            background: "#FAF7F2",
          }}
        />
      </div>

      {/* Roll Number */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#111111",
            display: "block",
            marginBottom: 6,
          }}
        >
          Roll Number *
        </label>
        <input
          type="text"
          value={member.rollNumber}
          onChange={(e) => setMember({ ...member, rollNumber: e.target.value })}
          placeholder="Enter roll number"
          required
          style={{
            width: "100%",
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            padding: "12px 14px",
            border: "2px solid #111111",
            borderRadius: 8,
            outline: "none",
            background: "#FAF7F2",
          }}
        />
      </div>

      {/* Year */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: 13,
            color: "#111111",
            display: "block",
            marginBottom: 6,
          }}
        >
          Year *
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setMember({ ...member, year: y })}
              style={{
                flex: 1,
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 800,
                fontSize: 14,
                padding: "10px",
                border: "2px solid #111111",
                borderRadius: 8,
                background: member.year === y ? "#FFD027" : "#FAF7F2",
                color: "#111111",
                cursor: "pointer",
                boxShadow: member.year === y ? "2px 2px 0 #111111" : "none",
                transition: "all 80ms",
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Branch and Section (VITS only) */}
      {college === "VITS" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Branch */}
          <div>
            <label
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                color: "#111111",
                display: "block",
                marginBottom: 6,
              }}
            >
              Branch *
            </label>
            <select
              value={member.branch}
              onChange={(e) => setMember({ ...member, branch: e.target.value })}
              required
              style={{
                width: "100%",
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                padding: "12px 14px",
                border: "2px solid #111111",
                borderRadius: 8,
                outline: "none",
                background: "#FAF7F2",
                cursor: "pointer",
              }}
            >
              <option value="">Select</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label
              style={{
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                fontSize: 13,
                color: "#111111",
                display: "block",
                marginBottom: 6,
              }}
            >
              Section *
            </label>
            <select
              value={member.section}
              onChange={(e) => setMember({ ...member, section: e.target.value })}
              required
              style={{
                width: "100%",
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                padding: "12px 14px",
                border: "2px solid #111111",
                borderRadius: 8,
                outline: "none",
                background: "#FAF7F2",
                cursor: "pointer",
              }}
            >
              <option value="">Select</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
