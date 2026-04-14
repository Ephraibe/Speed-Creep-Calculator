from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, field_validator
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import sqlite3
import json
from typing import Generator
from fastapi.middleware.cors import CORSMiddleware

with open("data/loomians.json", "r", encoding="utf-8") as file:
    raw_loomian_data = json.load(file)

LOOMIAN_QUERY = """
    SELECT
        s.set_id,
        u.username,
        s.item,
        s.ability,

        t.hp AS tp_hp, t.energy AS tp_energy, t.attack AS tp_attack,
        t.defense AS tp_defense, t.rattack AS tp_rattack, t.rdefense AS tp_rdefense, t.speed AS tp_speed,

        u2.hp AS up_hp, u2.energy AS up_energy, u2.attack AS up_attack,
        u2.defense AS up_defense, u2.rattack AS up_rattack, u2.rdefense AS up_rdefense, u2.speed AS up_speed,

        p.positive, p.negative, p.very,

        m.move

    FROM sets s
    JOIN users u ON u.user_id = s.user_id
    LEFT JOIN set_tps t ON t.set_id = s.set_id
    LEFT JOIN set_ups u2 ON u2.set_id = s.set_id
    LEFT JOIN set_personalities p ON p.set_id = s.set_id
    LEFT JOIN set_moves m ON m.set_id = s.set_id
    WHERE s.loomian = ?
"""

class Loomian(BaseModel):
    name: str
    types: list[str]
    speed: int

LOOMIANS = {
    name.lower(): Loomian(**data)
    for name, data in raw_loomian_data.items()
}

# ===============================
# Configuration
# ===============================

DATABASE = "data/sets.db"
SECRET_KEY = "CHANGE_THIS_TO_SOMETHING_RANDOM"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI()
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # your React dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================
# Database Dependency
# ===============================

def get_db() -> Generator:
    conn = sqlite3.connect(DATABASE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()

# ===============================
# Database Initialization
# ===============================

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sets (
            set_id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            loomian TEXT NOT NULL,
            item TEXT,
            ability TEXT,
            FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS set_tps (
            set_id INTEGER PRIMARY KEY,
            hp INTEGER, energy INTEGER, attack INTEGER,
            defense INTEGER, rattack INTEGER, rdefense INTEGER, speed INTEGER,
            FOREIGN KEY(set_id) REFERENCES sets(set_id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS set_ups (
            set_id INTEGER PRIMARY KEY,
            hp INTEGER, energy INTEGER, attack INTEGER,
            defense INTEGER, rattack INTEGER, rdefense INTEGER, speed INTEGER,
            FOREIGN KEY(set_id) REFERENCES sets(set_id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS set_personalities (
            set_id INTEGER PRIMARY KEY,
            positive TEXT,
            negative TEXT,
            very TEXT,
            FOREIGN KEY(set_id) REFERENCES sets(set_id) ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS set_moves (
            set_id INTEGER,
            move TEXT,
            PRIMARY KEY (set_id, move),
            FOREIGN KEY(set_id) REFERENCES sets(set_id) ON DELETE CASCADE
        )
    """)

    conn.commit()
    conn.close()

init_db()

# ===============================
# Models
# ===============================

class Stats(BaseModel):
    hp: int
    energy: int
    attack: int
    defense: int
    rattack: int
    rdefense: int
    speed: int

class Personality(BaseModel):
    positive: str
    negative: str
    very: str

class SetCreate(BaseModel):
    loomian: str
    item: str | None
    ability: str | None
    moves: list[str]
    tps: Stats
    ups: Stats = Stats(hp=40,energy=40,attack=40,defense=40,rattack=40,rdefense=40,speed=40)
    personality: Personality

    @field_validator("moves")
    @classmethod
    def validate_moves(cls, v):
        if len(v) != 4:
            raise ValueError("Exactly 4 moves required")
        return v

class UserCreate(BaseModel):
    username: str
    password: str

# ===============================
# Auth Utilities
# ===============================

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain, hashed):
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: sqlite3.Connection = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if user is None:
        raise credentials_exception
    return user

# ===============================
# Auth Endpoints
# ===============================

@app.post("/register")
def register(user: UserCreate, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute(
        "SELECT * FROM users WHERE username = ?",
        (user.username,)
    ).fetchone()

    if existing:
        raise HTTPException(400, "Username already exists")

    hashed = hash_password(user.password)

    db.execute(
        "INSERT INTO users (username, password_hash) VALUES (?, ?)",
        (user.username, hashed)
    )
    db.commit()

    return {"message": "User created successfully"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: sqlite3.Connection = Depends(get_db)):
    user = db.execute(
        "SELECT * FROM users WHERE username = ?",
        (form_data.username,)
    ).fetchone()

    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(400, "Incorrect username or password")

    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer"}

# ===============================
# Insert Set Function
# ===============================

def insert_set(db: sqlite3.Connection, set_data: SetCreate, user_id: int):
    cursor = db.cursor()

    cursor.execute("""
        INSERT INTO sets (user_id, loomian, item, ability)
        VALUES (?, ?, ?, ?)
    """, (user_id, set_data.loomian.lower(), set_data.item, set_data.ability))

    set_id = cursor.lastrowid

    tps = set_data.tps
    cursor.execute("""
        INSERT INTO set_tps VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (set_id, tps.hp, tps.energy, tps.attack,
          tps.defense, tps.rattack, tps.rdefense, tps.speed))

    ups = set_data.ups
    cursor.execute("""
        INSERT INTO set_ups VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (set_id, ups.hp, ups.energy, ups.attack,
          ups.defense, ups.rattack, ups.rdefense, ups.speed))

    p = set_data.personality
    cursor.execute("""
        INSERT INTO set_personalities VALUES (?, ?, ?, ?)
    """, (set_id, p.positive, p.negative, p.very))

    cursor.executemany("""
        INSERT INTO set_moves (set_id, move) VALUES (?, ?)
    """, [(set_id, move) for move in set_data.moves])

    db.commit()

# ===============================
# Protected Endpoint
# ===============================

@app.post("/submit")
def submit_set(
    new_set: SetCreate,
    current_user = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db)
):
    insert_set(db, new_set, current_user["user_id"])
    return {"status": "Set added successfully"}

@app.get("/loomians/{loomian_name}")
def get_loomian_page(
    loomian_name: str,
    db: sqlite3.Connection = Depends(get_db)
):
    loomian = LOOMIANS.get(loomian_name.lower())
    if not loomian:
        raise HTTPException(status_code=404, detail="Loomian not found")

    rows = db.execute(
        LOOMIAN_QUERY,
        (loomian_name.lower(),)
    ).fetchall()

    if not rows:
        return {
            "loomian": loomian,
            "sets": []
        }

    sets_by_id = {}

    for row in rows:
        set_id = row["set_id"]

        if set_id not in sets_by_id:
            sets_by_id[set_id] = {
                "set_id": set_id,
                "author": row["username"],
                "item": row["item"],
                "ability": row["ability"],
                "tps": {
                    "hp": row["tp_hp"],
                    "energy": row["tp_energy"],
                    "attack": row["tp_attack"],
                    "defense": row["tp_defense"],
                    "rattack": row["tp_rattack"],
                    "rdefense": row["tp_rdefense"],
                    "speed": row["tp_speed"],
                },
                "ups": {
                    "hp": row["up_hp"],
                    "energy": row["up_energy"],
                    "attack": row["up_attack"],
                    "defense": row["up_defense"],
                    "rattack": row["up_rattack"],
                    "rdefense": row["up_rdefense"],
                    "speed": row["up_speed"],
                },
                "personality": [
                    row["positive"],
                    row["negative"],
                    row["very"],
                ],
                "moves": []
            }

        if row["move"]:
            sets_by_id[set_id]["moves"].append(row["move"])

    return {
        "loomian": loomian,
        "sets": list(sets_by_id.values())
    }

@app.get("/sets/speeds")
def calculate_speeds(db: sqlite3.Connection = Depends(get_db)):
    results = []
    seen = set()

    for name, loomian in LOOMIANS.items():
        base_speed = loomian.speed
        is_air = "air" in [t.lower() for t in loomian.types]

        rows = db.execute(LOOMIAN_QUERY, (name,)).fetchall()
        

        for row in rows:
            if row["set_id"] in seen:
                continue
            seen.add(row["set_id"])


            speed_tp = row["tp_speed"] or 0        # from set_tps
            speed_up = row["up_speed"] or 0        # will fix below with aliasing

            # personality
            p = {
                "positive": row["positive"],
                "negative": row["negative"],
                "very": row["very"]
            }
            actualpersonality = p["very"] or p["positive"] or p["negative"] or "None"

            personality_bonus = 1.0

            if p["very"] == "Nimble":
                personality_bonus = 1.2
            elif p["very"] == "Sluggish":
                personality_bonus = 0.8
            elif p["positive"] == "Nimble":
                personality_bonus = 1.1
            elif p["negative"] == "Sluggish":
                personality_bonus = 0.9

            # speed formula
            final_speed = int((((2 * base_speed + speed_up + speed_tp / 4) * 50) / 100 + 5))
            final_speed = int(final_speed * personality_bonus)

            if row["item"] == "Specialty Boots":
                final_speed = int(final_speed * 1.5)

            wind_speed = int(final_speed * 1.25) if is_air else int(final_speed)

            # abilities
            ability = row["ability"]

            if ability in {"Hotfoot", "Prowler", "Rain Rush", "Overclock", "Sugar Rush"}:
                ability_speed = int(final_speed * 2)
            elif ability in {"Rush Hour", "Thriving Pace"}:
                ability_speed = int(final_speed * 1.5)
            else:
                ability_speed = final_speed

            if ability not in {"Hotfoot", "Prowler", "Rain Rush", "Overclock"} and is_air:
                wind_ability_speed = int(ability_speed * 1.25)
            else:
                wind_ability_speed = ability_speed

            results.append({
                "loomian": name,
                "set_id": row["set_id"],
                "base_speed": base_speed,
                "is_air": is_air,
                "item": row["item"],
                "personality": p,
                "ability": ability,
                "personality": p,
                "tps": speed_tp,
                "ups": speed_up,
                "final_speed": {
                    "normal": final_speed,
                    "wind": wind_speed,
                    "ability": ability_speed,
                    "ability_wind": wind_ability_speed
                }
            })
            

        

    return {"speeds": results}