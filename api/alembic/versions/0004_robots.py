"""机器人大厅：robots 与 robot_contacts

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "robots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("intro", sa.Text(), nullable=False, server_default=""),
        sa.Column("presets", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_robots_owner_id", "robots", ["owner_id"])

    op.create_table(
        "robot_contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("robot_id", sa.Integer(), sa.ForeignKey("robots.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("user_id", "robot_id", name="uq_robot_contact"),
    )
    op.create_index("ix_robot_contacts_user_id", "robot_contacts", ["user_id"])
    op.create_index("ix_robot_contacts_robot_id", "robot_contacts", ["robot_id"])


def downgrade() -> None:
    op.drop_index("ix_robot_contacts_robot_id", table_name="robot_contacts")
    op.drop_index("ix_robot_contacts_user_id", table_name="robot_contacts")
    op.drop_table("robot_contacts")
    op.drop_index("ix_robots_owner_id", table_name="robots")
    op.drop_table("robots")
