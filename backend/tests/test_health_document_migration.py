from pathlib import Path


MIGRATION = Path(
    "supabase/migrations/20260916064111_health_document_storage.sql"
)


def test_health_document_bucket_is_private_and_bounded() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    assert "'health-documents'" in sql
    assert "false" in sql
    assert "10485760" in sql
    assert "'application/pdf'" in sql
    assert "'image/png'" in sql
    assert "'image/jpeg'" in sql
    assert "'image/heic'" in sql


def test_only_server_role_receives_health_document_dml() -> None:
    sql = MIGRATION.read_text(encoding="utf-8").lower()

    for table in (
        "public.upload_files",
        "public.ocr_results",
        "public.health_checkups",
        "public.body_compositions",
    ):
        assert (
            f"grant select, insert, update, delete on table {table} to service_role;"
            in sql
        )
    assert "to authenticated" not in sql
    assert "to anon" not in sql
