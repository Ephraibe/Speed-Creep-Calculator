import requests
import os
import json
from time import sleep

LOOMIANS_FILE = "data/loomians.json"
OUTPUT_DIR = "sprites"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open("loomian-backend/data/loomians.json", "r", encoding="utf-8") as f:
    loomians = json.load(f)

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "Mozilla/5.0"})

for key, data in loomians.items():
    name = data["name"]
    clean_key = key.strip("'")
    output_path = os.path.join(OUTPUT_DIR, f"{clean_key}.png")

    if os.path.exists(output_path):
        print(f"Skipping {name}")
        continue

    filename = f"{name.replace(' ', '_')}-menu.png"

    api_url = (
        f"https://loomian-legacy.fandom.com/api.php"
        f"?action=query&titles=File:{filename}&prop=imageinfo"
        f"&iiprop=url&format=json"
    )

    try:
        res = SESSION.get(api_url).json()
        pages = res["query"]["pages"]
        page = next(iter(pages.values()))

        if "imageinfo" not in page:
            print(f"No image found for {name}")
            continue

        img_url = page["imageinfo"][0]["url"]
        img_data = SESSION.get(img_url).content

        with open(output_path, "wb") as f:
            f.write(img_data)

        print(f"Downloaded {name}")
        sleep(0.5)

    except Exception as e:
        print(f"Failed {name}: {e}")
