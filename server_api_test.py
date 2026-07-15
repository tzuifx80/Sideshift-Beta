import json
from urllib.error import HTTPError
from urllib.request import Request, urlopen


BASE = "http://127.0.0.1:8787"


def request(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = Request(BASE + path, data=data, method=method, headers={"content-type": "application/json"})
    try:
        with urlopen(req) as response:
            raw = response.read().decode()
            try:
                return response.status, json.loads(raw)
            except json.JSONDecodeError:
                return response.status, raw
    except HTTPError as error:
        raw = error.read().decode()
        try:
            return error.code, json.loads(raw)
        except json.JSONDecodeError:
            return error.code, raw


def main():
    status, root = request("GET", "/")
    assert status == 200 and "SideShift" in root

    status, health = request("GET", "/api/health")
    assert status == 200 and health["ok"] is True and health["aiMode"] == "MOCK_AI"

    status, analytics = request("POST", "/api/analytics", {"event": "landing_viewed", "properties": {"surface": "server-test"}})
    assert status == 202 and analytics["accepted"] is True

    status, created = request("POST", "/api/challenges", {"creatorId": "api-test", "take": {"id": "test", "statement": "A balanced test take.", "context": "Both sides have a reasonable case."}, "argument": "A concrete opening argument with a real trade-off."})
    assert status == 201
    token = created["token"]

    status, challenge = request("GET", f"/api/challenges/{token}")
    assert status == 200 and challenge["response"] is None

    rate_limited = None
    for _ in range(30):
        rate_limited = request("GET", f"/api/challenges/{token}")
    assert rate_limited[0] == 429 and rate_limited[1]["error"]["code"] == "rate_limited"

    status, challenge_route = request("GET", f"/challenge/{token}")
    assert status == 200 and "id=\"root\"" in challenge_route

    status, completed = request("POST", f"/api/challenges/{token}/respond", {"response": "A respectful counterargument with a clear boundary."})
    assert status == 201 and 0 <= completed["result"]["total"] <= 100

    status, duplicate = request("POST", f"/api/challenges/{token}/respond", {"response": "A second response that must be rejected."})
    assert status == 409 and duplicate["error"]["code"] == "challenge_completed"

    print("SERVER_API_OK")


if __name__ == "__main__":
    main()
