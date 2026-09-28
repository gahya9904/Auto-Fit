from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_github_action_runs_at_kst_midnight() -> None:
    workflow = (ROOT / ".github/workflows/daily-diet-refresh.yml").read_text()

    assert "- cron: \"0 15 * * *\"" in workflow
    assert "secrets.DIET_REFRESH_CRON_TOKEN" in workflow
    assert "/internal/diet-refresh" in workflow


def test_diet_migration_enforces_ai_source_mix() -> None:
    sql = (
        ROOT
        / "supabase/migrations/20260928082133_daily_ai_diet_refresh.sql"
    ).read_text()

    assert "source_type in ('db_catalog', 'ai_generated')" in sql
    assert "v_ai_meal_count not between 2 and 3" in sql
    assert "nullif(v_food_input ->> 'food_item_id', '')::uuid" in sql
