import pytest

from app.tools.chief_of_staff import sql_fallback as sql
from app.tools.chief_of_staff.sql_fallback import SqlRejected, validate_sql


def test_appends_limit_when_missing():
    assert validate_sql("SELECT count(*) FROM leads").endswith("LIMIT 200")


def test_caps_oversized_limit():
    out = validate_sql("SELECT * FROM leads LIMIT 500")
    assert "LIMIT 200" in out
    assert "500" not in out


def test_keeps_small_limit():
    out = validate_sql("SELECT * FROM leads LIMIT 10")
    assert out.strip().endswith("LIMIT 10")


@pytest.mark.parametrize("bad", [
    "DELETE FROM leads",
    "UPDATE leads SET status='booked'",
    "INSERT INTO leads VALUES (1)",
    "DROP TABLE leads",
    "GRANT ALL ON leads TO public",
    "COPY leads TO '/tmp/x'",
])
def test_rejects_writes_and_ddl(bad):
    with pytest.raises(SqlRejected):
        validate_sql(bad)


def test_rejects_stacked_statements():
    with pytest.raises(SqlRejected):
        validate_sql("SELECT 1; DROP TABLE leads")


def test_rejects_comments():
    with pytest.raises(SqlRejected):
        validate_sql("SELECT * FROM leads -- sneaky")
    with pytest.raises(SqlRejected):
        validate_sql("SELECT * FROM leads /* x */")


def test_rejects_non_select():
    with pytest.raises(SqlRejected):
        validate_sql("WITH x AS (SELECT 1) SELECT * FROM x")


def test_run_sql_readonly_tenant_scoped(ctx):
    out = sql.run_sql_readonly(ctx, sql="SELECT count(*) AS n FROM leads", purpose="count")
    assert out["ok"] is True
    assert out["rows"][0]["n"] == 18  # only Destination Pakistan rows are loaded
    assert out["executed_sql"].endswith("LIMIT 200")


def test_run_sql_readonly_rejects_write(ctx):
    out = sql.run_sql_readonly(ctx, sql="DELETE FROM leads")
    assert out["ok"] is False
    assert out["rejected"] is True


def test_run_sql_readonly_bad_column_is_handled(ctx):
    out = sql.run_sql_readonly(ctx, sql="SELECT nope FROM leads")
    assert out["ok"] is False
    assert "sql_error" in out["reason"]
