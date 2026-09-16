from backend.app.main import app


def test_all_diet_operations_are_grouped_in_openapi() -> None:
    paths = app.openapi()["paths"]
    diet_operations = [
        operation
        for path, methods in paths.items()
        if path.startswith("/api/diet/")
        for method, operation in methods.items()
        if method in {"get", "post", "patch", "delete"}
    ]

    assert len(diet_operations) == 12
    assert "patch" in paths["/api/diet/meals/{diet_meal_id}/feedback"]
    assert all(operation["tags"] == ["Diet"] for operation in diet_operations)
