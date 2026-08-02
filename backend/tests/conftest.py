import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.utils import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import Candidate, CandidateStatus, User, UserRole

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def create_user(db_session):
    def _create(email, password, role):
        user = User(email=email, hashed_password=hash_password(password), role=role)
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _create


@pytest.fixture
def create_candidate(db_session):
    def _create(**overrides):
        defaults = dict(
            name="Sam Lee",
            email="sam@example.com",
            role_applied="Frontend Engineer",
            status=CandidateStatus.NEW.value,
            skills=["React"],
        )
        defaults.update(overrides)
        candidate = Candidate(**defaults)
        db_session.add(candidate)
        db_session.commit()
        db_session.refresh(candidate)
        return candidate

    return _create


@pytest.fixture
def login(client):
    def _login(email, password):
        resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
        assert resp.status_code == 200
        return resp.json()["access_token"]

    return _login


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
