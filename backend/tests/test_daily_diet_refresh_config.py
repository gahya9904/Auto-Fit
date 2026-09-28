from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_render_cron_runs_at_kst_midnight() -> None:
    blueprint = (ROOT / "render.yaml").read_text()

    assert "name: auto-fit-diet-refresh-kst" in blueprint
    assert 'schedule: "0 15 * * *"' in blueprint
    assert "startCommand: python -m backend.app.diet_refresh" in blueprint


def test_diet_migration_enforces_ai_source_mix() -> None:
    sql = (
        ROOT
        / "supabase/migrations/20260928082133_daily_ai_diet_refresh.sql"
    ).read_text()

    assert "source_type in ('db_catalog', 'ai_generated')" in sql
    assert "v_ai_meal_count not between 2 and 3" in sql
    assert "nullif(v_food_input ->> 'food_item_id', '')::uuid" in sql
