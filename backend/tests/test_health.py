from fastapi import FastAPI

from main import app


def test_app_starts(client):
    assert isinstance(app, FastAPI)
    assert client.get("/openapi.json").status_code == 200


def test_health_returns_200(client):
    assert client.get("/health").status_code == 200


def test_health_body(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_unknown_route_is_404_json(client):
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    assert "detail" in response.json()


def test_cors_preflight_allowed(client):
    response = client.options(
        "/health",
        headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
