"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import json
import os
import secrets
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")


def load_users() -> dict:
    users_file = current_dir / "users.json"
    with users_file.open("r", encoding="utf-8") as file:
        data = json.load(file)

    return {user["username"]: user for user in data.get("users", [])}


def get_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    return authorization.split(" ", 1)[1].strip()


def get_current_user(authorization: Optional[str]) -> dict:
    token = get_bearer_token(authorization)
    user = sessions.get(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user


def is_staff(role: str) -> bool:
    return role in {"staff", "teacher", "admin"}


users = load_users()
sessions = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/auth/login")
def login(payload: LoginRequest):
    user = users.get(payload.username)

    if not user or user.get("password") != payload.password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(24)
    sessions[token] = {
        "username": user["username"],
        "role": user["role"],
        "email": user["email"]
    }

    return {
        "token": token,
        "user": {
            "username": user["username"],
            "role": user["role"],
            "email": user["email"]
        }
    }


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(default=None)):
    token = get_bearer_token(authorization)
    sessions.pop(token, None)
    return {"message": "Logged out successfully"}


@app.get("/auth/me")
def me(authorization: Optional[str] = Header(default=None)):
    return get_current_user(authorization)


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(
    activity_name: str,
    email: str,
    authorization: Optional[str] = Header(default=None)
):
    """Sign up a student for an activity"""
    current_user = get_current_user(authorization)

    # Students can only modify their own registration.
    if not is_staff(current_user["role"]) and email.lower() != current_user["email"].lower():
        raise HTTPException(
            status_code=403,
            detail="Students can only sign themselves up"
        )

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(
    activity_name: str,
    email: str,
    authorization: Optional[str] = Header(default=None)
):
    """Unregister a student from an activity"""
    current_user = get_current_user(authorization)

    # Students can only modify their own registration.
    if not is_staff(current_user["role"]) and email.lower() != current_user["email"].lower():
        raise HTTPException(
            status_code=403,
            detail="Students can only unregister themselves"
        )

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
