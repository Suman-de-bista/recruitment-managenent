from app.models import UserRole

from tests.conftest import auth_headers


def test_list_candidates_filters_by_status_and_role(client, create_user, create_candidate, login):
    create_user("admin1@example.com", "adminpass123", UserRole.ADMIN.value)
    create_candidate(
        name="Jane Doe", email="jane@example.com", role_applied="Backend Engineer",
        status="new", skills=["Python", "SQL"],
    )
    create_candidate(
        name="Mo Chen", email="mo@example.com", role_applied="Frontend Engineer",
        status="hired", skills=["React"],
    )

    token = login("admin1@example.com", "adminpass123")
    resp = client.get(
        "/api/v1/candidates",
        params={"status": "new", "role_applied": "Backend Engineer"},
        headers=auth_headers(token),
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Jane Doe"


def test_reviewer_cannot_see_another_reviewers_scores(client, create_user, create_candidate, login):
    create_user("admin2@example.com", "adminpass123", UserRole.ADMIN.value)
    create_user("reviewer1@example.com", "reviewerpass1", UserRole.REVIEWER.value)
    create_user("reviewer2@example.com", "reviewerpass2", UserRole.REVIEWER.value)
    candidate = create_candidate(name="Sam Lee", email="sam@example.com", skills=["React", "Communication"])

    admin_token = login("admin2@example.com", "adminpass123")
    r1_token = login("reviewer1@example.com", "reviewerpass1")
    r2_token = login("reviewer2@example.com", "reviewerpass2")

    client.post(
        f"/api/v1/candidates/{candidate.id}/scores",
        json={"category": "React", "score": 4, "note": "good"},
        headers=auth_headers(r1_token),
    )
    client.post(
        f"/api/v1/candidates/{candidate.id}/scores",
        json={"category": "Communication", "score": 2, "note": "meh"},
        headers=auth_headers(r2_token),
    )

    detail_as_r1 = client.get(f"/api/v1/candidates/{candidate.id}", headers=auth_headers(r1_token))
    assert detail_as_r1.status_code == 200
    scores = detail_as_r1.json()["scores"]
    assert len(scores) == 1
    assert scores[0]["score"] == 4

    detail_as_admin = client.get(f"/api/v1/candidates/{candidate.id}", headers=auth_headers(admin_token))
    assert len(detail_as_admin.json()["scores"]) == 2


def test_reviewer_cannot_create_candidate_and_register_ignores_role(client, create_user, login):
    # register endpoint must ignore any role sent by the client
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "hacker@example.com", "password": "hackerpass1", "role": "admin"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "reviewer"

    reviewer_token = login("hacker@example.com", "hackerpass1")

    # candidate creation is admin-only
    create_resp = client.post(
        "/api/v1/candidates",
        json={"name": "Kim", "email": "kim@example.com", "role_applied": "Backend Engineer", "skills": ["Python"]},
        headers=auth_headers(reviewer_token),
    )
    assert create_resp.status_code == 403
