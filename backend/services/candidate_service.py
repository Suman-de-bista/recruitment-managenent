from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Candidate, Score


def build_fallback_summary(candidate: Candidate, scores: list[Score]) -> str:
    """Mock AI summary generator.

    This project always uses this fallback path — there is no real LLM call
    wired in (see README for the trade-off). The shape mirrors how a real
    async LLM call would be structured: build a prompt-worthy context from
    the candidate + their scores, then return generated text.
    """
    skills = ", ".join(candidate.skills) if candidate.skills else "no listed skills"
    if scores:
        avg_score = sum(s.score for s in scores) / len(scores)
        score_line = f"Average score so far: {avg_score:.1f}/5 across {len(scores)} review(s)."
    else:
        score_line = "No scores submitted yet."

    return (
        f"{candidate.name} applied for {candidate.role_applied} with skills in {skills}. "
        f"Current status: {candidate.status}. {score_line} "
        "This is a mock AI-generated summary."
    )


def search_candidates(
    db: Session,
    status: str | None,
    role_applied: str | None,
    skill: str | None,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Candidate], int]:
    """Filter and paginate candidates entirely in SQL.

    This is the corrected counterpart to the buggy snippet described in the
    README's Debugging Signal section: filtering, keyword search, and
    pagination all happen as part of the SQL query (WHERE + LIMIT/OFFSET)
    instead of pulling the whole table into Python and slicing it there.
    """
    conditions = [Candidate.deleted_at.is_(None)]

    if status:
        conditions.append(Candidate.status == status)
    if role_applied:
        conditions.append(Candidate.role_applied == role_applied)
    if keyword:
        like = f"%{keyword}%"
        conditions.append(or_(Candidate.name.ilike(like), Candidate.email.ilike(like)))

    base_stmt = select(Candidate).where(*conditions)

    if skill:
        # skills is a JSON list column; filtering happens in Python only for
        # this one predicate since SQLite JSON containment isn't portable
        # via the ORM. Every other predicate stays in SQL.
        candidates = db.execute(base_stmt.order_by(Candidate.created_at.desc())).scalars().all()
        candidates = [c for c in candidates if skill.lower() in [s.lower() for s in (c.skills or [])]]
        total = len(candidates)
        offset = (page - 1) * page_size
        return candidates[offset : offset + page_size], total

    total_count = db.execute(select(func.count()).select_from(Candidate).where(*conditions)).scalar_one()

    offset = (page - 1) * page_size
    stmt = base_stmt.order_by(Candidate.created_at.desc()).offset(offset).limit(page_size)
    items = db.execute(stmt).scalars().all()
    return items, total_count
