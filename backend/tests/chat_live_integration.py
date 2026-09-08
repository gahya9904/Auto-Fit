"""Opt-in live test. Creates and removes only this run's synthetic users/data.

Run: python -m backend.tests.chat_live_integration --project eeeqibyssajykrhvecbv
Never emits credentials, tokens, or response bodies.
"""
import argparse
import asyncio
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
from dotenv import dotenv_values

from backend.app import main


async def run(project):
    config = dotenv_values("backend/.env")
    assert config["SUPABASE_URL"].rstrip("/") == f"https://{project}.supabase.co", "Wrong target"
    settings = main.Settings(config["SUPABASE_URL"].rstrip("/"), config["SUPABASE_PUBLISHABLE_KEY"], config["SUPABASE_SERVICE_ROLE_KEY"], "http://localhost:3000")
    admin_headers = main.service_headers(settings)
    created_users = []
    cleanup_errors = []
    checks = 0

    def check(condition, label):
        nonlocal checks
        assert condition, label
        checks += 1
        print(f"PASS {label}", flush=True)

    async with httpx.AsyncClient(base_url=settings.supabase_url, timeout=20) as remote:
        try:
            tokens = []
            for _ in range(2):
                email = f"autofit-chat-test-{uuid4().hex}@example.invalid"
                password = secrets.token_urlsafe(32)
                response = await remote.post("/auth/v1/admin/users", headers=admin_headers, json={
                    "email": email, "password": password, "email_confirm": True,
                    "app_metadata": {"autofit_integration_test": True},
                })
                check(response.status_code in (200, 201), "create synthetic auth user")
                user_id = response.json()["id"]
                created_users.append(user_id)
                response = await remote.post("/auth/v1/token?grant_type=password", headers={"apikey": settings.supabase_publishable_key}, json={"email": email, "password": password})
                check(response.status_code == 200, "real Supabase password login")
                tokens.append(response.json()["access_token"])

            # Controlled source data for the owner only.
            for offset, score in ((2, 91), (1, 86)):
                response = await remote.post("/rest/v1/health_assessments", headers=admin_headers, json={
                    "user_id": created_users[0], "assessed_at": (datetime.now(UTC) - timedelta(days=offset)).isoformat(),
                    "overall_score": score, "overall_status": "test",
                })
                check(response.status_code == 201, "seed synthetic health score")

            main.app.dependency_overrides[main.get_settings] = lambda: settings
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test", timeout=40) as api:
                owner = {"Authorization": f"Bearer {tokens[0]}"}
                other = {"Authorization": f"Bearer {tokens[1]}"}
                check((await api.get("/api/chats")).status_code == 401, "unauthenticated access rejected")
                response = await api.post("/api/chats", headers=owner, json={})
                check(response.status_code == 201, "create chat through authenticated API")
                chat = response.json()["chat"]["chat_id"]
                path = f"/api/chats/{chat}/messages"
                check((await api.get(path, headers=other)).status_code == 404, "other user cannot read chat")
                check((await api.patch(f"/api/chats/{chat}", headers=other, json={"title":"denied"})).status_code == 404, "other user cannot update chat")
                check((await api.post(path, headers=other, json={"client_message_id":str(uuid4()),"content":"건강 점수"})).status_code == 404, "other user cannot send to chat")
                body = {"client_message_id":str(uuid4()),"content":"건강 점수가 이전보다 얼마나 변했어?"}
                # Concurrent HTTP calls use independent remote DB transactions.
                responses = await asyncio.gather(*(api.post(path, headers=owner, json=body) for _ in range(6)))
                check(sorted(r.status_code for r in responses) == [200]*5+[201], "six concurrent duplicates persist once")
                ids = {r.json()["assistant_message"]["message_id"] for r in responses}
                check(len(ids) == 1, "all duplicate responses return the same message")
                answer = responses[0].json()["assistant_message"]
                check(answer["response_source"] == "database" and answer["evidence"][0]["current_value"] == 86 and answer["evidence"][0]["previous_value"] == 91, "real DB score comparison answer")
                check((await api.post(path, headers=owner, json={**body,"content":"different"})).status_code == 409, "same ID different content conflicts")
                conflict_id = str(uuid4())
                conflicts = await asyncio.gather(*(api.post(path, headers=owner, json={"client_message_id":conflict_id,"content":q}) for q in ("안녕", "다른 질문")))
                check(sorted(r.status_code for r in conflicts) == [201,409], "concurrent different content chooses one winner")
                page = (await api.get(path, headers=owner, params={"limit":2})).json()
                check(page["has_more"] and len(page["messages"])==2, "message pagination first page")
                older = (await api.get(path, headers=owner, params={"limit":2,"before":page["next_cursor"]})).json()
                check(not older["has_more"] and len({m["message_id"] for m in page["messages"]+older["messages"]})==4, "message pagination no duplicates or omissions")
                check(page["messages"][0]["sender_type"] == "user" and page["messages"][1]["sender_type"] == "assistant", "user then assistant order")
                response = await api.patch(f"/api/chats/{chat}", headers=owner, json={"status":"archived"})
                check(response.status_code == 200, "archive chat")
                check((await api.post(path, headers=owner, json=body)).status_code == 200, "replay still works after archive")
                check((await api.post(path, headers=owner, json={"client_message_id":str(uuid4()),"content":"안녕"})).status_code == 409, "new message to archived chat rejected")
                listing = (await api.get("/api/chats", headers=owner, params={"status":"archived"})).json()
                check(any(c["chat_id"]==chat for c in listing["chats"]), "archived list contains chat")
                # Authenticated clients must not call the service-only RPC directly.
                direct = await remote.post("/rest/v1/rpc/save_chat_exchange", headers={"apikey": settings.supabase_publishable_key, **owner}, json={"p_user_id":created_users[0],"p_chat_id":chat,"p_client_message_id":str(uuid4()),"p_content":"denied","p_answer":None})
                check(direct.status_code in (401,403,404), "direct client RPC denied")
        finally:
            main.app.dependency_overrides.clear()
            for user_id in created_users:
                for table in ("chat_messages", "chats", "health_assessments", "profiles"):
                    response = await remote.delete(f"/rest/v1/{table}", headers=admin_headers, params={"user_id":f"eq.{user_id}"})
                    if response.status_code not in (200,204):
                        cleanup_errors.append(f"{table}:{user_id}")
                response = await remote.delete(f"/auth/v1/admin/users/{user_id}", headers=admin_headers)
                if response.status_code not in (200,204):
                    cleanup_errors.append(f"auth:{user_id}")
            if cleanup_errors:
                raise RuntimeError("Test resource cleanup required: " + ",".join(cleanup_errors))
            print(f"Cleaned up {len(created_users)} synthetic users and their test records.", flush=True)
    print(f"Completed {checks} live integration checks.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    asyncio.run(run(parser.parse_args().project))
