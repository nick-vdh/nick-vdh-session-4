import pytest
from fastapi.testclient import TestClient

import src.app as app_module


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(
        app_module,
        "capabilities",
        {
            "Example": {
                "capacity": 40,
                "consultants": ["existing@example.com"],
            }
        },
    )
    return TestClient(app_module.app)


def test_availability_updates_aggregate_without_replacing_legacy_capacity(client):
    response = client.put(
        "/capabilities/Example/consultants/availability",
        params={"email": "existing@example.com", "available_hours": 12.5},
    )

    assert response.status_code == 200
    capability = client.get("/capabilities").json()["Example"]
    assert capability["consultant_availability"] == {"existing@example.com": 12.5}
    assert capability["recorded_available_hours"] == 12.5
    assert capability["availability_recorded_count"] == 1
    assert capability["capacity"] == 40


def test_unrecorded_availability_keeps_legacy_capacity_visible(client):
    capability = client.get("/capabilities").json()["Example"]

    assert capability["consultant_availability"] == {}
    assert capability["recorded_available_hours"] == 0
    assert capability["availability_recorded_count"] == 0
    assert capability["capacity"] == 40


def test_registration_records_availability_and_unregistration_removes_it(client):
    registration = client.post(
        "/capabilities/Example/register",
        params={"email": "new@example.com", "available_hours": 8},
    )
    assert registration.status_code == 200
    capability = client.get("/capabilities").json()["Example"]
    assert capability["consultant_availability"]["new@example.com"] == 8
    assert capability["recorded_available_hours"] == 8

    unregister = client.delete(
        "/capabilities/Example/unregister",
        params={"email": "new@example.com"},
    )
    assert unregister.status_code == 200

    capability = client.get("/capabilities").json()["Example"]
    assert "new@example.com" not in capability["consultant_availability"]
    assert capability["recorded_available_hours"] == 0


@pytest.mark.parametrize(
    "available_hours",
    [-1, -0.5, float("nan"), float("inf")],
)
def test_negative_availability_is_rejected(client, available_hours):
    response = client.put(
        "/capabilities/Example/consultants/availability",
        params={"email": "existing@example.com", "available_hours": available_hours},
    )

    assert response.status_code == 422


def test_availability_cannot_be_set_for_an_unregistered_consultant(client):
    response = client.put(
        "/capabilities/Example/consultants/availability",
        params={"email": "missing@example.com", "available_hours": 5},
    )

    assert response.status_code == 400