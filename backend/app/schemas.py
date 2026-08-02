from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import CandidateStatus, UserRole

ROLE_OPTIONS = [
    "Backend Engineer",
    "Frontend Engineer",
    "Full Stack Engineer",
    "DevOps Engineer",
    "QA Engineer",
    "Product Designer",
]

SKILL_OPTIONS = [
    "Python",
    "FastAPI",
    "SQL",
    "React",
    "TypeScript",
    "JavaScript",
    "Docker",
    "AWS",
    "Kubernetes",
    "Communication",
    "System Design",
    "Testing",
]


def validate_role(value: str | None) -> str | None:
    if value is not None and value not in ROLE_OPTIONS:
        raise ValueError("role_applied must be one of the allowed options")
    return value


def validate_skills(value: list[str] | None) -> list[str] | None:
    if value is None:
        return value
    invalid = [skill for skill in value if skill not in SKILL_OPTIONS]
    if invalid:
        raise ValueError(f"Unsupported skills: {', '.join(invalid)}")
    return value


# ---- Auth ----


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # No `role` field on purpose — registration is always hardcoded to
    # "reviewer" server-side (see routers/auth.py). Never accept role from
    # the client.


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    role: UserRole
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


# ---- Scores ----


class ScoreBase(BaseModel):
    category: str = Field(min_length=1, max_length=120)
    score: int = Field(ge=1, le=5)
    note: str | None = None


class ScoreCreate(ScoreBase):
    pass


class ScoreRead(ScoreBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    reviewer_id: int
    reviewer_email: str | None = None
    created_at: datetime


# ---- Candidates ----


class CandidateBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    role_applied: str = Field(min_length=1, max_length=120)
    skills: list[str] = Field(default_factory=list)

    _validate_role = field_validator("role_applied")(validate_role)
    _validate_skills = field_validator("skills")(validate_skills)


class CandidateCreate(CandidateBase):
    status: CandidateStatus = CandidateStatus.NEW


class CandidateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    role_applied: str | None = Field(default=None, min_length=1, max_length=120)
    status: CandidateStatus | None = None
    skills: list[str] | None = None
    internal_notes: str | None = None

    _validate_role = field_validator("role_applied")(validate_role)
    _validate_skills = field_validator("skills")(validate_skills)


class CandidateSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role_applied: str
    status: CandidateStatus
    skills: list[Any]
    created_at: datetime


class CandidateRead(CandidateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: CandidateStatus
    internal_notes: str | None = None
    ai_summary: str | None = None
    ai_summary_generated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CandidateDetail(CandidateRead):
    scores: list[ScoreRead] = Field(default_factory=list)


class CandidateListResponse(BaseModel):
    items: list[CandidateSummary]
    total: int
    page: int
    page_size: int


class CandidateOptions(BaseModel):
    roles: list[str]
    skills: list[str]
    statuses: list[CandidateStatus]


class SummaryOut(BaseModel):
    ai_summary: str


class Message(BaseModel):
    detail: str
