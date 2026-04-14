import sqlite3
import json

DATABASE = "data/sets.db"
parsed_sets_file = "data/parsed_sets.json"

# Load parsed sets from JSON
with open(parsed_sets_file, "r") as f:
    parsed_data = json.load(f)

# Transform parsed sets to match database schema
sets = []
for item in parsed_data:
    # Parse personality field
    personality_raw = item.get("personality")
    positive_personality = None
    negative_personality = None
    very_personality = None
    
    if personality_raw:
        if personality_raw.startswith("Very"):
            very_personality = personality_raw.split()[1]
        elif "Nimble" in personality_raw:
            positive_personality = "Nimble"
        elif "Sluggish" in personality_raw:
            negative_personality = "Sluggish"
        
        
    actual_personality = very_personality or positive_personality or negative_personality or "None"
    
    # Build stat tuples: (hp, energy, attack, defense, rattack, rdefense, speed)
    # All stats default to 0 except speed
    tps = (0, 0, 0, 0, 0, 0, item.get("speed_tp", 0))
    ups = (0, 0, 0, 0, 0, 0, item.get("speed_up", 0))
    
    set_dict = {
        "loomian": item.get("loomian"),
        "item": item.get("item"),
        "personality": personality_raw,
        "ability": item.get("ability"),
        "moves": ["move1", "move2", "move3", "move4"],
        "tps": tps,
        "ups": ups,
        "positive_personality": positive_personality,
        "negative_personality": negative_personality,
        "very_personality": very_personality,
    }
    sets.append(set_dict)

conn = sqlite3.connect(DATABASE)
conn.execute("PRAGMA foreign_keys = ON")

# Create seed user if it doesn't exist
conn.execute("INSERT OR IGNORE INTO users (username, password_hash) VALUES ('seed', 'seed')")
user_id = conn.execute("SELECT user_id FROM users WHERE username = 'seed'").fetchone()[0]

for s in sets:
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sets (user_id, loomian, item, ability) VALUES (?, ?, ?, ?)",
        (user_id, s["loomian"], s["item"], s["ability"]))
    set_id = cursor.lastrowid
    cursor.execute("INSERT INTO set_tps VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (set_id, *s["tps"]))
    cursor.execute("INSERT INTO set_ups VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (set_id, *s["ups"]))
    cursor.execute("INSERT INTO set_personalities VALUES (?, ?, ?, ?)", 
        (set_id, s["positive_personality"], s["negative_personality"], s["very_personality"]))
    cursor.executemany("INSERT INTO set_moves (set_id, move) VALUES (?, ?)",
        [(set_id, m) for m in s["moves"]])

conn.commit()
conn.close()
print("Seeded successfully")