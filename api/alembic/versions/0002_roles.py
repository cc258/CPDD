"""users 角色改造：is_admin -> role，新增 email / avatar_url

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=16), nullable=False, server_default="user"),
    )
    op.add_column("users", sa.Column("email", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=512), nullable=True))
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 原管理员升级为超级管理员
    op.execute("UPDATE users SET role = 'super_admin' WHERE is_admin = true")

    op.drop_column("users", "is_admin")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE users SET is_admin = true WHERE role IN ('super_admin', 'admin')")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "email")
    op.drop_column("users", "role")
