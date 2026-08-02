import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.utils import get_current_user, is_admin, require_admin
from app.database import get_db
from app.models import Candidate, CandidateStatus, Score, User
from app.schemas import (
    CandidateCreate,
    CandidateDetail,
    CandidateListResponse,
    CandidateOptions,
    CandidateUpdate,
    Message,
    ROLE_OPTIONS,
    ScoreCreate,
    ScoreRead,
    SKILL_OPTIONS,
    SummaryOut,
)
from services.candidate_service import build_fallback_summary, search_candidates

router = APIRouter(prefix="/candidates", tags=["candidates"])

# In-process pub/sub for the SSE stretch goal: one asyncio.Queue per
# connected client, grouped by candidate_id. Good enough for a single
# backend instance/demo; a multi-worker deployment would need a shared
# broker (e.g. Redis pub/sub) instead since queues here are per-process.
score_streams: dict[int, list[asyncio.Queue]] = defaultdict(list)


async def publish_score_event(candidate_id: int, score: Score) -> None:
    event = {
        "type": "score_updated",
        "score": {
            "id": score.id,
            "candidate_id": score.candidate_id,
            "category": score.category,
            "score": score.score,
            "reviewer_id": score.reviewer_id,
        },
    }
    for queue in score_streams.get(candidate_id, []):
        await queue.put(event)


def get_candidate_or_404(db: Session, candidate_id: int, *, include_deleted: bool = False) -> Candidate:
    query = db.query(Candidate).filter(Candidate.id == candidate_id)
    if not include_deleted:
        query = query.filter(Candidate.deleted_at.is_(None))
    candidate = query.first()
    if candidate is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return candidate


def get_visible_scores_query(db: Session, candidate_id: int, current_user: User):
    query = db.query(Score).filter(Score.candidate_id == candidate_id)
    if not is_admin(current_user):
        query = query.filter(Score.reviewer_id == current_user.id)
    return query


def serialize_score(score: Score, *, include_reviewer: bool) -> ScoreRead:
    data = ScoreRead.model_validate(score).model_dump()
    if not include_reviewer:
        data["reviewer_email"] = None
    return ScoreRead(**data)


def build_candidate_detail(db: Session, candidate: Candidate, current_user: User) -> CandidateDetail:
    admin = is_admin(current_user)
    data = {
        "id": candidate.id,
        "name": candidate.name,
        "email": candidate.email,
        "role_applied": candidate.role_applied,
        "skills": candidate.skills,
        "status": candidate.status,
        "internal_notes": candidate.internal_notes if admin else None,
        "ai_summary": candidate.ai_summary,
        "ai_summary_generated_at": candidate.ai_summary_generated_at,
        "created_at": candidate.created_at,
        "updated_at": candidate.updated_at,
    }
    scores = (
        get_visible_scores_query(db, candidate.id, current_user).order_by(Score.created_at.desc()).all()
    )
    data["scores"] = [serialize_score(s, include_reviewer=admin) for s in scores]
    return CandidateDetail(**data)


@router.get("/options", response_model=CandidateOptions)
def get_candidate_options(current_user: User = Depends(get_current_user)):
    return CandidateOptions(roles=ROLE_OPTIONS, skills=SKILL_OPTIONS, statuses=list(CandidateStatus))


@router.get("", response_model=CandidateListResponse)
def list_candidates(
    status_filter: str | None = Query(default=None, alias="status"),
    role_applied: str | None = None,
    skill: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items, total = search_candidates(db, status_filter, role_applied, skill, keyword, page, page_size)
    return CandidateListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CandidateDetail, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    candidate = Candidate(**payload.model_dump())
    db.add(candidate)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Candidate email already exists"
        ) from exc
    db.refresh(candidate)
    return build_candidate_detail(db, candidate, current_user)


@router.get("/{candidate_id}", response_model=CandidateDetail)
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = get_candidate_or_404(db, candidate_id, include_deleted=True)
    return build_candidate_detail(db, candidate, current_user)


@router.patch("/{candidate_id}", response_model=CandidateDetail)
def update_candidate(
    candidate_id: int,
    payload: CandidateUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    candidate = get_candidate_or_404(db, candidate_id, include_deleted=True)
    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(candidate, field, value)

    if updates.get("status") == CandidateStatus.ARCHIVED.value:
        candidate.deleted_at = candidate.deleted_at or datetime.now(timezone.utc)
    elif "status" in updates and candidate.deleted_at is not None:
        candidate.deleted_at = None

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Candidate email already exists"
        ) from exc
    db.refresh(candidate)
    return build_candidate_detail(db, candidate, current_user)


@router.delete("/{candidate_id}", response_model=Message)
def archive_candidate(
    candidate_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    candidate = get_candidate_or_404(db, candidate_id)
    candidate.status = CandidateStatus.ARCHIVED.value
    candidate.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return Message(detail="Candidate archived")


@router.post("/{candidate_id}/summary", response_model=SummaryOut)
async def generate_candidate_summary(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = get_candidate_or_404(db, candidate_id, include_deleted=True)
    scores = get_visible_scores_query(db, candidate_id, current_user).all()

    # Simulates an async LLM call: network latency + generation delay. A
    # real integration would wrap this in try/except and raise 502 on
    # failure so the frontend can render an error state instead of hanging.
    await asyncio.sleep(2)
    summary = build_fallback_summary(candidate, scores)

    candidate.ai_summary = summary
    candidate.ai_summary_generated_at = datetime.now(timezone.utc)
    db.commit()
    return SummaryOut(ai_summary=summary)


@router.get("/{candidate_id}/scores", response_model=list[ScoreRead])
def list_candidate_scores(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_candidate_or_404(db, candidate_id, include_deleted=True)
    admin = is_admin(current_user)
    scores = get_visible_scores_query(db, candidate_id, current_user).order_by(Score.created_at.desc()).all()
    return [serialize_score(s, include_reviewer=admin) for s in scores]


@router.post("/{candidate_id}/scores", response_model=ScoreRead, status_code=status.HTTP_201_CREATED)
async def create_candidate_score(
    candidate_id: int,
    payload: ScoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = get_candidate_or_404(db, candidate_id)
    if payload.category not in (candidate.skills or []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Score category must be one of the candidate's skills",
        )

    # A reviewer scoring the same candidate in the same category again
    # updates their existing score rather than adding another row — one
    # score per reviewer per category keeps the average meaningful instead
    # of letting a reviewer skew it by resubmitting.
    score = (
        db.query(Score)
        .filter(
            Score.candidate_id == candidate_id,
            Score.reviewer_id == current_user.id,
            Score.category == payload.category,
        )
        .first()
    )
    if score is not None:
        score.score = payload.score
        score.note = payload.note
    else:
        score = Score(
            candidate_id=candidate_id,
            reviewer_id=current_user.id,  # always from the JWT, never from the request body
            **payload.model_dump(),
        )
        db.add(score)

    db.commit()
    db.refresh(score)
    await publish_score_event(candidate_id, score)
    return serialize_score(score, include_reviewer=is_admin(current_user))


@router.get("/{candidate_id}/stream")
async def stream_candidate_scores(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE stretch goal: streams live score updates for a candidate.

    Reviewers only receive events for their own scores (matching the
    visibility rule everywhere else); admins receive all. Auth works the
    same as every other endpoint — the browser's EventSource sends the
    httpOnly cookie automatically when created with withCredentials: true.
    """
    get_candidate_or_404(db, candidate_id, include_deleted=True)
    admin = is_admin(current_user)

    queue: asyncio.Queue = asyncio.Queue()
    score_streams[candidate_id].append(queue)

    async def event_generator():
        try:
            yield "event: connected\ndata: {}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25)
                except asyncio.TimeoutError:
                    yield "event: heartbeat\ndata: {}\n\n"
                    continue

                if not admin and event["score"]["reviewer_id"] != current_user.id:
                    continue
                yield f"event: score_updated\ndata: {json.dumps(event['score'])}\n\n"
        finally:
            queues = score_streams.get(candidate_id, [])
            if queue in queues:
                queues.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
