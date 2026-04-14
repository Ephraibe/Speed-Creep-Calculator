current_set = {}
sets = []
abilities = [
  "Hotfoot", "Prowler", "Rain Rush", "Overclock", "Sugar Rush",
  "Rush Hour", "Thriving Pace"
]
prev_was_header = False

with open("FreeSets.txt", "r", encoding="utf-8") as file:
    for line in file:
        line_lower = line.lower().strip()
        if line.startswith("> **"):
            if current_set:
                sets.append(current_set)
            current_set = {"name": line.replace(">", "").replace("**", "").strip(), "loomian": None, "item": None, "personality": None, "speed_tp": 0, "speed_up": 40, "ability": None}
            prev_was_header = True
        elif prev_was_header:
            if line.strip() == "":  # skip blank lines
                continue
            current_set["loomian"] = line.strip().lower()
            prev_was_header = False
        elif current_set:
            if line_lower.startswith("item:"):
                if "specialty boots" in line_lower:
                    current_set["item"] = "Specialty Boots"
            elif line_lower.startswith("personality:"):
                if "very nimble" in line_lower:
                    current_set["personality"] = "Very Nimble"
                elif "nimble" in line_lower:
                    current_set["personality"] = "Nimble"
                elif "very sluggish" in line_lower:
                    current_set["personality"] = "Very Sluggish"
                elif "sluggish" in line_lower:
                    current_set["personality"] = "Sluggish"
            elif line_lower.startswith("tps:"):
                segments = line_lower.replace("tps:", "").split(",")
                for segment in segments:
                    if "speed" in segment:
                        current_set["speed_tp"] = int(segment.strip().split()[0])
            elif line_lower.startswith("ups"):
                segments = line_lower.replace("ups:", "").split(",")
                for segment in segments:
                    if "speed" in segment:
                        current_set["speed_up"] = int(segment.strip().split()[0].split("-")[0])
            elif line_lower.startswith("ability:"):
                for ability in abilities:
                    if ability.lower() in line_lower:
                        current_set["ability"] = ability

if current_set:
    sets.append(current_set)

import json

with open("parsed_sets.json", "w", encoding="utf-8") as f:
    json.dump(sets, f, indent=2)