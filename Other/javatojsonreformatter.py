import json
import re

with open("notepadiwillreformat.txt", "r", encoding="utf-8") as f:
    content = f.read()

# Remove single-line comments
content = re.sub(r'//.*', '', content)
# Remove trailing commas
while True:
    new = re.sub(r',\s*([}\]])', r'\1', content)
    if new == content:
        break
    content = new
    
# Quote unquoted keys (including hyphenated ones)
content = content.replace('heavy bag:', '"heavy-bag":')
# then run the regex after
content = re.sub(r'([\w][\w-]*)\s*:', r'"\1":', content)
# Fix keys with spaces like "heavy bag"
content = content.replace('"heavy bag":', '"heavy-bag":')
# Remove the outer semicolon if present
content = content.strip()
if content.endswith('};'):
    content = content[:-2]
elif content.endswith('}'):
    content = content[:-1]
content = "{" + content + "}"

print(repr(content[131150:131250]))
data = json.loads(content)

output = {}
for key, val in data.items():
    output[key] = {
        "name": val["name"],
        "types": val["types"],
        "speed": val["baseStats"]["speed"],
        "finalEvo": val.get("finalEvo", True),
    }

with open("loomians.json", "w", encoding="utf-8") as f:
    json.dump(output, f, indent=4)

print(f"Extracted {len(output)} loomians")