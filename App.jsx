import { useState, useEffect, useMemo } from "react";

const API_BASE = "http://127.0.0.1:8000";

const ABILITIES = [
  "None", "Hotfoot", "Prowler", "Rain Rush", "Overclock", "Sugar Rush",
  "Rush Hour", "Thriving Pace"
];

const ITEMS = ["None", "Specialty Boots"];

const PERSONALITIES = [
  { label: "Neutral", very: "", positive: "", negative: "" },
  { label: "Very Nimble", very: "Nimble", positive: "", negative: "" },
  { label: "Very Sluggish", very: "Sluggish", positive: "", negative: "" },
  { label: "Nimble (positive)", very: "", positive: "Nimble", negative: "" },
  { label: "Sluggish (negative)", very: "", positive: "", negative: "Sluggish" },
];

function calcSpeed({ baseSpeed, isAir, speedTp, speedUp, personality, item, ability, windOn, abilitiesOn }) {
  const personalityBonus =
    personality.very === "Nimble" ? 1.2 :
    personality.very === "Sluggish" ? 0.8 :
    personality.positive === "Nimble" ? 1.1 :
    personality.negative === "Sluggish" ? 0.9 : 1.0;

  let speed = (((2 * baseSpeed + speedUp + speedTp / 4) * 50) / 100 + 5);
  speed = Math.floor(speed * personalityBonus);
  if (item === "Specialty Boots") speed = Math.floor(speed * 1.5);

  let result = speed;

  if (abilitiesOn) {
    if (["Hotfoot", "Prowler", "Rain Rush", "Overclock", "Sugar Rush"].includes(ability)) {
      result = Math.floor(speed * 2);
    } else if (["Rush Hour", "Thriving Pace"].includes(ability)) {
      result = Math.floor(speed * 1.5);
    }
  }

  if (windOn && isAir) {
    const canGetWind = !abilitiesOn || !["Hotfoot", "Prowler", "Rain Rush", "Overclock"].includes(ability);
    if (canGetWind) result = Math.floor(result * 1.25);
  }

  return result;
}

function getSpeedFromEntry(entry, windOn, abilitiesOn) {
  if (windOn && abilitiesOn) return entry.final_speed.ability_wind;
  if (windOn) return entry.final_speed.wind;
  if (abilitiesOn) return entry.final_speed.ability;
  return entry.final_speed.normal;
}

function SpeedRow({ entry, highlight, mySpeed }) {
  const diff = entry.displaySpeed - mySpeed;
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
  const isBase = entry.isBase;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 80px 80px 70px",
        alignItems: "center",
        padding: "9px 16px",
        borderRadius: 6,
        background: highlight
          ? "rgba(251, 191, 36, 0.12)"
          : isBase
          ? "rgba(99,102,241,0.06)"
          : "rgba(255,255,255,0.03)",
        border: highlight
          ? "1px solid rgba(251,191,36,0.5)"
          : "1px solid transparent",
        marginBottom: 3,
        transition: "background 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 11,
          fontFamily: "monospace",
          color: isBase ? "#818cf8" : "#64748b",
          background: isBase ? "rgba(99,102,241,0.15)" : "rgba(100,116,139,0.15)",
          borderRadius: 4,
          padding: "1px 6px",
          letterSpacing: 1,
        }}>
          {isBase ? "BASE" : "SET"}
        </span>
        <span style={{ fontWeight: highlight ? 700 : 400, color: highlight ? "#fbbf24" : "#e2e8f0", fontSize: 14 }}>
          {entry.loomian}
        </span>
        {!isBase && entry.item && entry.item !== "None" && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>· {entry.item}</span>
        )}
        {!isBase && entry.ability && entry.ability !== "None" && (
          <span style={{ fontSize: 11, color: "#94a3b8" }}>· {entry.ability}</span>
        )}
      </div>
      <div style={{ textAlign: "right", fontFamily: "monospace", color: "#e2e8f0", fontSize: 14 }}>
        {entry.displaySpeed}
      </div>
      <div style={{
        textAlign: "right",
        fontFamily: "monospace",
        fontSize: 13,
        color: diff > 0 ? "#f87171" : diff < 0 ? "#4ade80" : "#fbbf24",
      }}>
        {highlight ? "—" : diffStr}
      </div>
      <div style={{ textAlign: "right", fontSize: 11, color: "#64748b" }}>
        {isBase ? "" : `by ${entry.author ?? "?"}`}
      </div>
    </div>
  );
}

function SpeedDisplay({ entry, highlight, mySpeed }) {
  const diff = entry.displaySpeed - mySpeed;
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
  const isBase = entry.isBase;
  const name = entry.loomian;
  const speed = entry.displaySpeed;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 24,
        marginBottom: 24,
        flexShrink: 0,
      }}
    >
      <div style={{color: diff > 0 ? "#f87171" : diff < 0 ? "#4ade80" : "#fbbf24", margin: "4px", fontFamily: "monospace"}}>
        {speed}
        {highlight ? "—" : diffStr}
      </div>
      <div>
        {name}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontSize: 24, color: "#fff3ec", marginBottom: 8 }}>
      Loomian Legacy Speed Creep Calculator
      </div>
    </div>
  )
}

export default function SpeedCalculator() {
  const [allSets, setAllSets] = useState([]);
  const [allLoomians, setAllLoomians] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [loomianInput, setLoomianInput] = useState("");
  const [selectedLoomian, setSelectedLoomian] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const [speedTp, setSpeedTp] = useState(0);
  const [speedUp, setSpeedUp] = useState(40);
  const [ability, setAbility] = useState("None");
  const [item, setItem] = useState("None");
  const [personality, setPersonality] = useState(PERSONALITIES[0]);

  const [windOn, setWindOn] = useState(false);
  const [abilitiesOn, setAbilitiesOn] = useState(false);
  const [includeBase, setIncludeBase] = useState(false);

  const NEIGHBORS = 3;

  useEffect(() => {
    async function fetchData() {
      try {
          const [setsRes, loomsRaw] = await Promise.all([
              fetch(`${API_BASE}/sets/speeds`),
              fetch(`/data/loomians.json`),
          ]);
          const setsData = await setsRes.json();
          const loomsData = await loomsRaw.json();
          setAllSets(setsData.speeds ?? []);
          setAllLoomians(loomsData);
      } catch (e) {
          setError("Could not reach the backend. Is it running?");
      } finally {
          setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Autocomplete
  const loomianNames = useMemo(() => Object.keys(allLoomians), [allLoomians]);

  function handleLoomianInput(val) {
    setLoomianInput(val);
    setSelectedLoomian(null);
    if (!val) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    setSuggestions(loomianNames.filter(n => n.includes(q)).slice(0, 6));
  }

  function selectLoomian(name) {
    setSelectedLoomian(name);
    setLoomianInput(allLoomians[name]?.name ?? name);
    setSuggestions([]);
  }

  const myBaseSpeed = selectedLoomian ? allLoomians[selectedLoomian]?.speed ?? 0 : 0;
  const myIsAir = selectedLoomian
    ? (allLoomians[selectedLoomian]?.types ?? []).map(t => t.toLowerCase()).includes("air")
    : false;

  const mySpeed = selectedLoomian
    ? calcSpeed({ baseSpeed: myBaseSpeed, isAir: myIsAir, speedTp, speedUp, personality, item, ability, windOn, abilitiesOn })
    : null;

  const pool = useMemo(() => {
    const entries = allSets.map(s => ({
      ...s,
      displaySpeed: getSpeedFromEntry(s, windOn, abilitiesOn),
      isBase: false,
    }));

    if (includeBase) {
      Object.entries(allLoomians).forEach(([key, loom]) => {
        const baseSpd = calcSpeed({
          baseSpeed: loom.speed,
          isAir: loom.types.map(t => t.toLowerCase()).includes("air"),
          speedTp: 0, speedUp: 40,
          personality: PERSONALITIES[0],
          item: "None", ability: "None",
          windOn, abilitiesOn,
        });
        entries.push({
          loomian: loom.name,
          displaySpeed: baseSpd,
          isBase: true,
          final_speed: { normal: baseSpd, wind: baseSpd, ability: baseSpd, ability_wind: baseSpd },
          item: null, ability: null,
        });
      });
    }

    return entries.sort((a, b) => a.displaySpeed - b.displaySpeed);
  }, [allSets, allLoomians, windOn, abilitiesOn, includeBase]);

  const { slower, faster, myEntry } = useMemo(() => {
    if (mySpeed === null) return { slower: [], faster: [], myEntry: null };

    const me = {
      loomian: selectedLoomian ? (allLoomians[selectedLoomian]?.name ?? selectedLoomian) : "You",
      displaySpeed: mySpeed,
      isBase: false,
      isMe: true,
    };

    const slower = pool.filter(e => e.displaySpeed < mySpeed).slice(-NEIGHBORS).reverse();
    const faster = pool.filter(e => e.displaySpeed > mySpeed).slice(0, NEIGHBORS);

    return { slower, faster, myEntry: me };
  }, [pool, mySpeed, selectedLoomian, allLoomians]);

  const Toggle = ({ label, value, onChange }) => (
    <button
      onClick={() => onChange(!value)}
      style={{
        padding: "6px 14px",
        borderRadius: 20,
        border: "1px solid",
        borderColor: value ? "#6366f1" : "#334155",
        background: value ? "rgba(99,102,241,0.2)" : "transparent",
        color: value ? "#a5b4fc" : "#64748b",
        fontSize: 13,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "inherit",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0f1e",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "40px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        input, select { outline: none; }
        input[type=range] { accent-color: #6366f1; }
        .suggestion-item:hover { background: rgba(99,102,241,0.15) !important; }
      `}</style>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <Header />

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: 16, marginBottom: 24, color: "#fca5a5", fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Results */}
        {loading && (
          <div style={{ color: "#64748b", textAlign: "center", padding: 40 }}>Loading sets...</div>
        )}

        {!loading && mySpeed !== null && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 24,
          }}>

            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 80px 70px",
              fontSize: 11, letterSpacing: 2, color: "#475569",
              textTransform: "uppercase", padding: "0 16px", marginBottom: 10,
            }}>
              <div>Loomian</div>
              <div style={{ textAlign: "right" }}>Speed</div>
              <div style={{ textAlign: "right" }}>Diff</div>
              <div style={{ textAlign: "right" }}>Author</div>
            </div>

            {faster.length === 0 && slower.length === 0 && (
              <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
                No sets to compare yet. Submit some sets first!
              </div>
            )}

            {/* Faster (above) */}
            {[...faster].reverse().map((e, i) => (
              <SpeedRow key={`faster-${i}`} entry={e} highlight={false} mySpeed={mySpeed} />
            ))}

            {/* You */}
            <SpeedRow
              entry={{ loomian: allLoomians[selectedLoomian]?.name ?? selectedLoomian, displaySpeed: mySpeed, isBase: false, isMe: true }}
              highlight={true}
              mySpeed={mySpeed}
            />

            {/* Slower (below) */}
            {slower.map((e, i) => (
              <SpeedRow key={`slower-${i}`} entry={e} highlight={false} mySpeed={mySpeed} />
            ))}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#475569" }}>
              Showing up to {NEIGHBORS} faster and {NEIGHBORS} slower •{" "}
              Green diff = you're faster · Red diff = they're faster
            </div>
          </div>
        )}

        {!loading && mySpeed !== null && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 24,
          }}>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflowX: "auto",
              marginBottom: 16,
            }}>
              {/* Faster (above) */}
              {[...faster].reverse().map((e, i) => (
                <SpeedDisplay key={`faster-${i}`} entry={e} highlight={false} mySpeed={mySpeed} />
              ))}

              {/* You */}
              <SpeedDisplay
                entry={{ loomian: allLoomians[selectedLoomian]?.name ?? selectedLoomian, displaySpeed: mySpeed, isBase: false, isMe: true }}
                highlight={true}
                mySpeed={mySpeed}
              />

              {/* Slower (below) */}
              {slower.map((e, i) => (
                <SpeedDisplay key={`slower-${i}`} entry={e} highlight={false} mySpeed={mySpeed} />
              ))}
            </div>

            {faster.length === 0 && slower.length === 0 && (
              <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
                No sets to compare yet. Submit some sets first!
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#475569" }}>
              Showing up to {NEIGHBORS} faster and {NEIGHBORS} slower •{" "}
              Green diff = you're faster · Red diff = they're faster
            </div>
          </div>
        )}

        {!loading && mySpeed === null && !error && (
          <div style={{
            textAlign: "center", color: "#334155", padding: "60px 0",
            fontSize: 14, letterSpacing: 1,
          }}>
            Select a Loomian to get started
          </div>
        )}

        {/* Config Panel */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#64748b", textTransform: "uppercase", marginBottom: 20 }}>
            Your Loomian
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* Loomian picker */}
            <div style={{ position: "relative", gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>Loomian</label>
              <input
                value={loomianInput}
                onChange={e => handleLoomianInput(e.target.value)}
                placeholder="Search..."
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", fontSize: 14,
                }}
              />
              {suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
                  background: "#111827", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, marginTop: 4, overflow: "hidden",
                }}>
                  {suggestions.map(s => (
                    <div
                      key={s}
                      className="suggestion-item"
                      onClick={() => selectLoomian(s)}
                      style={{ padding: "10px 14px", cursor: "pointer", fontSize: 14, color: "#e2e8f0" }}
                    >
                      {allLoomians[s]?.name ?? s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Speed TPs */}
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
                Speed TPs: <span style={{ color: "#a5b4fc" }}>{speedTp}</span>
              </label>
              <input type="range" min={0} max={200} value={speedTp}
                onChange={e => setSpeedTp(+e.target.value)} style={{ width: "100%" }} />
            </div>

            {/* Speed UPs */}
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
                Speed UPs: <span style={{ color: "#a5b4fc" }}>{speedUp}</span>
              </label>
              <input type="range" min={0} max={200} value={speedUp}
                onChange={e => setSpeedUp(+e.target.value)} style={{ width: "100%" }} />
            </div>

            {/* Personality */}
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>Personality</label>
              <select
                value={personality.label}
                onChange={e => setPersonality(PERSONALITIES.find(p => p.label === e.target.value))}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", fontSize: 14,
                }}
              >
                {PERSONALITIES.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
              </select>
            </div>

            {/* Item */}
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>Item</label>
              <select
                value={item}
                onChange={e => setItem(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", fontSize: 14,
                }}
              >
                {ITEMS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {/* Ability */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>Ability</label>
              <select
                value={ability}
                onChange={e => setAbility(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#e2e8f0", fontSize: 14,
                }}
              >
                {ABILITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Toggle label="🌬 Wind" value={windOn} onChange={setWindOn} />
            <Toggle label="⚡ Abilities" value={abilitiesOn} onChange={setAbilitiesOn} />
            <Toggle label="📊 Include base speeds" value={includeBase} onChange={setIncludeBase} />
          </div>
        </div>

        
      </div>
    </div>
  );
}
