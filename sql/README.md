# 数据库手工脚本说明

## `add_users_quality_id.sql`

当 Flask 迁移未执行或执行失败，但 `models.py` 里已有 `User.quality_id` 时，会出现：

`Unknown column 'users.quality_id'`

**做法（二选一）：**

### 方式一：推荐 —— 用 Flask-Migrate

在项目根目录、已激活的 conda 环境中：

```bash
set FLASK_APP=app.py
flask db upgrade
```

### 方式二：手工执行 SQL

1. 用 MySQL 客户端连接到你的库（`config.py` 里 `MYSQL_DB`，默认 `water_quality`）。
2. 执行 `sql/add_users_quality_id.sql` 里的语句。
3. 若你平时用 Alembic 记录版本，执行完后建议打上迁移标记，避免下次 `upgrade` 重复执行：

```bash
set FLASK_APP=app.py
flask db stamp b7e2a1c0d4f8
```

（`b7e2a1c0d4f8` 对应 `migrations/versions/b7e2a1c0d4f8_add_users_quality_id.py`）
