import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import hash_password
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Candidate, CandidateStatus, Score, User, UserRole


def seed_users(db) -> dict[str, User]:
    if db.query(User).count() > 0:
        print("Users already exist, skipping user seed.")
        return {u.email: u for u in db.query(User).all()}

    admin = User(
        email=settings.seed_admin_email,
        hashed_password=hash_password(settings.seed_admin_password),
        role=UserRole.ADMIN.value,
    )
    reviewer = User(
        email=settings.seed_reviewer_email,
        hashed_password=hash_password(settings.seed_reviewer_password),
        role=UserRole.REVIEWER.value,
    )
    db.add_all([admin, reviewer])
    db.commit()
    db.refresh(admin)
    db.refresh(reviewer)
    print(f"Seeded admin: {admin.email} / {settings.seed_admin_password}")
    print(f"Seeded reviewer: {reviewer.email} / {settings.seed_reviewer_password}")
    return {admin.email: admin, reviewer.email: reviewer}


def seed_candidates(db, reviewer: User) -> None:
    if db.query(Candidate).count() > 0:
        print("Candidates already exist, skipping candidate seed.")
        return

    candidates = [
        Candidate(
            name="Sujan Poudel",
            email="sujan.poudel@example.com",
            role_applied="Backend Engineer",
            status=CandidateStatus.NEW.value,
            skills=["Python", "FastAPI", "SQL"],
        ),
        Candidate(
            name="Anisha Subedi",
            email="anisha.subedi@example.com",
            role_applied="Frontend Engineer",
            status=CandidateStatus.REVIEWED.value,
            skills=["React", "TypeScript", "JavaScript"],
        ),
        Candidate(
            name="Bibek Giri",
            email="bibek.giri@example.com",
            role_applied="Backend Engineer",
            status=CandidateStatus.NEW.value,
            skills=["Python", "Docker", "AWS"],
        ),
        Candidate(
            name="Sabina Rai",
            email="sabina.rai@example.com",
            role_applied="DevOps Engineer",
            status=CandidateStatus.HIRED.value,
            skills=["Docker", "Kubernetes", "AWS"],
        ),
        Candidate(
            name="Prabin Thapa",
            email="prabin.thapa@example.com",
            role_applied="Frontend Engineer",
            status=CandidateStatus.REJECTED.value,
            skills=["React", "JavaScript"],
        ),
        Candidate(
            name="Kripa Maharjan",
            email="kripa.maharjan@example.com",
            role_applied="Full Stack Engineer",
            status=CandidateStatus.NEW.value,
            skills=["Python", "React", "System Design"],
        ),
    ]
    db.add_all(candidates)
    db.commit()
    for c in candidates:
        db.refresh(c)

    db.add_all(
        [
            Score(
                candidate_id=candidates[0].id,
                reviewer_id=reviewer.id,
                category="Python",
                score=4,
                note="Strong grasp of async patterns.",
            ),
            Score(
                candidate_id=candidates[1].id,
                reviewer_id=reviewer.id,
                category="React",
                score=5,
                note="Excellent component design.",
            ),
        ]
    )
    db.commit()
    print(f"Seeded {len(candidates)} candidates with sample scores.")


def main() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        users = seed_users(db)
        reviewer = users.get(settings.seed_reviewer_email) or db.query(User).filter(
            User.role == UserRole.REVIEWER.value
        ).first()
        seed_candidates(db, reviewer)
    finally:
        db.close()


if __name__ == "__main__":
    main()
