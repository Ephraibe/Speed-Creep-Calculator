import { useState, useEffect, useMemo } from "react";

const API_BASE = "https://speed-creep-calculator.onrender.com";

const ABILITIES = [
  "None", "Hotfoot", "Prowler", "Rain Rush", "Overclock", "Sugar Rush",
  "Rush Hour", "Thriving Pace"
];

const ITEMS = ["None", "Specialty Boots"];

const PERSONALITIES = [
  { label: "Neutral",       very: "",         positive: "",       negative: "" },
  { label: "Very Nimble",   very: "Nimble",   positive: "",       negative: "" },
  { label: "Very Sluggish", very: "Sluggish", positive: "",       negative: "" },
  { label: "Nimble",        very: "",         positive: "Nimble", negative: "" },
  { label: "Sluggish",      very: "",         positive: "",       negative: "Sluggish" },
];

function calcSpeed({ baseSpeed, isAir, speedTp, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost }) {
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

  if (paralyzed) result = Math.floor(result * 0.5);

  if (statBoost !== 0) {
    const m = (2 + Math.abs(statBoost)) * 0.5;
    result = Math.floor(statBoost < 0 ? result / m : result * m);
  }

  return result;
}

function minTpsToBeat(targetSpeed, { baseSpeed, isAir, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost }) {
    for (let tp = 0; tp <= 200; tp += 8) {
        const speed = calcSpeed({ baseSpeed, isAir, speedTp: tp, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost });
        if (speed >= targetSpeed) return tp;
    }
    return null; // can't beat it even at 200 TPs
}

function getSpeedFromEntry(entry, windOn, abilitiesOn) {
  if (windOn && abilitiesOn) return entry.final_speed.ability_wind;
  if (windOn) return entry.final_speed.wind;
  if (abilitiesOn) return entry.final_speed.ability;
  return entry.final_speed.normal;
}

function SetData({ loomian, speedTp, speedUp, personality, item, ability }) {
  return (
    <div
      style={{
        background: "rgba(0, 41, 82, 0.57)",
        border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8,
        width: "100%",
      }}
    >
      <div>{loomian}, {speedTp ? `${speedTp}` : 0}, {speedUp ? `${speedUp}` : 40}</div>
      <div>
        {personality.very ? `Very ${personality.very}`: 
        personality.positive ? personality.positive: 
        personality.negative ? personality.negative: 
        "-"}
      </div>
      <div>{item ? item : "-"}</div>
      <div>{ability ? ability : "-"}</div>
    </div>
  );
}

function SpeedDisplay({ entry, highlight, mySpeed, myStats, MyTps, onHover }) {
  const minTps = minTpsToBeat(entry.displaySpeed, myStats);
  const diff = minTps === null ? null : minTps - MyTps === 0 ? -8 : minTps - MyTps;
  const diffStr =
    diff === null ? " X" :
    diff > 0 ? `+${diff}` :
    diff < 0 ? `${diff}` : "";
  const name = entry.loomian;
  const speed = entry.displaySpeed;

  return (
    <div
      onMouseEnter={() => onHover?.(entry)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: highlight ? "3px solid rgba(255,255,255)" : "1px solid rgba(255,255,255,0.08)",
        fontSize: "1em",
        position: "relative",
        height: "100%",
        width: "100%",
      }}
    >
      <div style={{ color: "#e2e8f0", margin: "auto", fontFamily: "monospace" }}>
        <span>{speed}</span>
        <span style={{color: 
                highlight ? "#e2e8f0" :
                diffStr === " X" ? "#64748b" :
                speed === mySpeed ? "#fbbf24" : 
                diff > 0 ? "#f87171" : 
                diff < 0 ? "#4ade80" : 
                "#e2e8f0"}}>
          {highlight ? "" : diffStr}
        </span>
      </div>
      <div> 
        <img
          style={{ width: "100%", height: "100%" }}
          src={`/sprites/${name.toLowerCase()}.png`}
        />
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
  const [hoveredEntry, setHoveredEntry] = useState(null);

  const [windOn, setWindOn] = useState(false);
  const [abilitiesOn, setAbilitiesOn] = useState(false);
  const [includeBase, setIncludeBase] = useState(false);
  const [includeNFE, setIncludeNFE] = useState(false);
  const [paralyzed, setParalyzed] = useState(false);
  const [statBoost, setStatBoost] = useState(0);

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
          setError("Could not load default sets, try again later.");
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
    ? calcSpeed({ baseSpeed: myBaseSpeed, isAir: myIsAir, speedTp, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost })
    : null;
  const mySpeedSlowest = selectedLoomian
    ? calcSpeed({ baseSpeed: myBaseSpeed, isAir: myIsAir, speedTp: 0, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost })
    : null;
  const mySpeedFastest = selectedLoomian
    ? calcSpeed({ baseSpeed: myBaseSpeed, isAir: myIsAir, speedTp: 200, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost })
    : null;

  const pool = useMemo(() => {
    const entries = allSets.map(s => ({
      ...s,
      displaySpeed: getSpeedFromEntry(s, windOn, abilitiesOn),
      isBase: false,

      // These are used for the tooltip
      speedTp: s.tps,
      speedUp: s.ups,
    }));


    if (includeBase) {
      Object.entries(allLoomians).forEach(([key, loom]) => {
        if (!includeNFE && loom.finalEvo !== true) return;
        const baseSpd = calcSpeed({
          baseSpeed: loom.speed,
          isAir: loom.types.map(t => t.toLowerCase()).includes("air"),
          speedTp: 0, speedUp: 40,
          personality: PERSONALITIES[0],
          item: "None", ability: "None",
          windOn, abilitiesOn, paralyzed: false,
          statBoost: 0,
        });

        entries.push({
          loomian: loom.name,
          displaySpeed: baseSpd,
          isBase: true,
          final_speed: { normal: baseSpd, wind: baseSpd, ability: baseSpd, ability_wind: baseSpd },
          personality: PERSONALITIES[0],
          item: null, ability: null,
        });
      });
    }

    return entries.sort((a, b) => a.displaySpeed - b.displaySpeed);
  }, [allSets, allLoomians, windOn, abilitiesOn, includeBase, includeNFE]);

  const { slower, faster, same, myEntry } = useMemo(() => {
    if (mySpeed === null) return { slower: [], faster: [], same: [], myEntry: null };

    const me = {
      loomian: selectedLoomian ? (allLoomians[selectedLoomian]?.name ?? selectedLoomian) : "You",
      displaySpeed: mySpeed,
      isBase: false,
      isMe: true,
    };
    
    const slower = pool.filter(e => e.displaySpeed < mySpeed && e.displaySpeed >= mySpeedSlowest);
    const same = pool.filter(e => e.displaySpeed === mySpeed && e.loomian !== me.loomian);
    const sorted = [...pool].sort((a, b) => a.displaySpeed - b.displaySpeed);
    const fasterBase = sorted.filter(
      e => e.displaySpeed > mySpeed && e.displaySpeed <= mySpeedFastest
    );

    // find the ones just above the range
    const fasterExtras = sorted
      .filter(e => e.displaySpeed > mySpeedFastest)
      .slice(0, 10); // first 3 (closest ones)

    const faster = [...fasterBase, ...fasterExtras];

    return { slower, faster, same, myEntry: me };
  }, [pool, mySpeed, mySpeedSlowest, mySpeedFastest, selectedLoomian, allLoomians, paralyzed, statBoost]);

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

      <div style={{ width: "100%", margin: "0 auto" }}>
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

        {!loading && (
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
            padding: 4,
          }}>
            
            {/* Slower & Faster */}
            <div style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "nowrap",
              justifyContent: "space-evenly",
              fontSize: 11, 
              letterSpacing: 2, 
              color: "#ffffff",
              textTransform: "uppercase", 
              marginBottom: 16,
            }}>
              {/* Slower (left) */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(44px, 1fr))",
                background: "rgba(0, 50, 4, 0.57)",
                padding: 8,
                borderRadius: 12,
                gap: 8,
                fontSize: "1em", 
                letterSpacing: 0, 
                color: "#ffffff",
                textTransform: "uppercase",
                width: "49%",
                height: "250px",
                overflowY: "auto",
              }}>
                {[...slower].reverse().map((e, i) => {
                  let prev = [...slower].reverse()[i - 1];
                  if (prev && (getSpeedFromEntry(prev, windOn, abilitiesOn) === getSpeedFromEntry(e, windOn, abilitiesOn)) && (prev.loomian === e.loomian)) {
                    return null;
                  }

                  return (
                    <SpeedDisplay 
                      key={`slower-${i}`} 
                      entry={e} 
                      highlight={false} 
                      mySpeed={mySpeed}
                      myStats={{ baseSpeed: myBaseSpeed, isAir: myIsAir, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost }}
                      MyTps={speedTp}
                      onHover={setHoveredEntry}
                    />
                  );
                })}
              </div>

              {/* Faster (right) */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(44px, 1fr))",
                background: "rgba(50, 0, 0, 0.57)",
                padding: 8,
                borderRadius: 12,
                gap: 8,
                fontSize: "1em", 
                letterSpacing: 0, 
                color: "#ffffff",
                textTransform: "uppercase",
                width: "49%",
                height: "250px",
                overflowY: "auto",
              }}>
                {faster.map((e, i) => {
                  let prev = faster[i - 1];
                  if (prev && (getSpeedFromEntry(prev, windOn, abilitiesOn) === getSpeedFromEntry(e, windOn, abilitiesOn)) && (prev.loomian === e.loomian)) {
                    return null;
                  }

                  return (
                    <SpeedDisplay 
                      key={`faster-${i}`} 
                      entry={e} 
                      highlight={false} 
                      mySpeed={mySpeed}
                      myStats={{ baseSpeed: myBaseSpeed, isAir: myIsAir, speedUp, personality, item, ability, windOn, abilitiesOn, paralyzed, statBoost }}
                      MyTps={speedTp}
                      onHover={setHoveredEntry}
                    />
                  );
                })}
              </div>
            </div>

            {/* Selected/Same Speed Loomians and config panel */}
            <div style={{
              //background: "rgba(255, 3, 3, 0.89)",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignContent: "center",
              alignItems: "center",
              justifyContent: "space-evenly",
              fontSize: 11, 
              letterSpacing: 2, 
              color: "#ffffff",
              textTransform: "uppercase", 
              marginBottom: 16,
            }}>

              {/* Slider Configs */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", width: "258px", padding: 16, gap: 9}}>
                {/* Speed TPs */}
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
                    Speed TPs: <span style={{ color: "#a5b4fc" }}>{speedTp}</span>
                  </label>
                  <input type="range" min={0} max={200} value={speedTp} step={8}
                    onChange={e => setSpeedTp(+e.target.value)} style={{ width: "100%" }} />

                {/* Speed UPs */}
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
                    Speed UPs: <span style={{ color: "#a5b4fc" }}>{speedUp}</span>
                  </label>
                  <input type="range" min={0} max={40} value={speedUp}
                    onChange={e => setSpeedUp(+e.target.value)} style={{ width: "100%" }} />

                {/* Stat Boost */}
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6 }}>
                    Stat Boost: <span style={{ color: "#a5b4fc" }}>{statBoost}</span>
                  </label>
                  <input type="range" min={-6} max={6} value={statBoost}
                    onChange={e => setStatBoost(+e.target.value)} style={{ width: "100%" }} />

              </div>
              
              {/* Dropdown Configs */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", width: "258px", padding: 16}}>
                {/* Personality */}
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

                {/* Item */}
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

                {/* Ability */}
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
              
              {/* Selected/Same Speed Loomians */}
              <div style={{ display: "flex", flexDirection: "column", width: "258px" }}>
                <div style={{
                  //background: "rgba(3, 255, 74, 0.89)",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "nowrap",
                  alignContent: "flex-start",
                  fontSize: 11, 
                  letterSpacing: 2, 
                  marginBottom: 16,
                  width: "100%",
                  height: "163px",
                }}>

                  {/* Sets with the same speed as the selected Loomian */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(1, minmax(44px, 1fr))",
                    background: "rgba(50, 37, 0, 0.57)",
                    padding: 8,
                    gap: 8,
                    fontSize: "1em", 
                    letterSpacing: 0, 
                    color: "#ffffff",
                    textTransform: "uppercase",
                    width: "25%",
                    height: "100%",
                    overflowY: "auto",
                  }}>
                    {same.map((e, i) => {
                      let prev = same[i - 1];
                      if (prev && (getSpeedFromEntry(prev, windOn, abilitiesOn) === getSpeedFromEntry(e, windOn, abilitiesOn)) && (prev.loomian === e.loomian)) {
                        return null;
                      }
                      return (
                        <div key={`same-${i}`}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            fontSize: "1em",
                            height: "100%",
                            maxHeight: 44,
                            width: "100%",
                          }}
                        >
                          <img
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            src={`/sprites/${e.loomian.toLowerCase()}.png`} 
                          />
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* You */}
                  <div
                    style={{
                      //background: "rgba(54, 6, 228, 0.9)",
                      //border: "1px solid rgba(255,255,255,0.08)",
                      aspectRatio: "1 / 1",
                      height: "100%",
                    }}
                  >
                    {mySpeed}
                    <img
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      src={`/sprites/${allLoomians[selectedLoomian]?.name.toLowerCase()}.png`} 
                    />
                  </div>

                </div>
                
                {/* Loomian picker */}
                <div style={{ position: "relative"}}>
                  <input
                    value={loomianInput}
                    onChange={e => handleLoomianInput(e.target.value)}
                    placeholder="Select a Loomian..."
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

              </div>
              
              {/* Hovered Loomian Data */}
              <div style={{ width: "258px" }}>
                  {hoveredEntry && (
                    <div style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
                      <SetData
                        loomian={hoveredEntry.loomian}
                        speedTp={hoveredEntry.speedTp}
                        speedUp={hoveredEntry.speedUp}
                        personality={hoveredEntry.personality}
                        item={hoveredEntry.item}
                        ability={hoveredEntry.ability}
                      />
                    </div>
                  )}
              </div>
            </div>
              
            {/* Toggles */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", padding: 12}}>
              <Toggle label="Wind" value={windOn} onChange={setWindOn} />
              <Toggle label="Abilities" value={abilitiesOn} onChange={setAbilitiesOn} />
              <Toggle label="Include base speeds" value={includeBase} onChange={setIncludeBase} />
              <Toggle label="Include NFE" value={includeNFE} onChange={setIncludeNFE} />
              <Toggle label="Paralyzed" value={paralyzed} onChange={setParalyzed} />
            </div>

            {faster.length === 0 && slower.length === 0 && (
              <div style={{ color: "#64748b", fontSize: 14, textAlign: "center", padding: "24px 0" }}>
                No sets to compare :/
              </div>
            )}

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
      </div>
    </div>
  );
}
