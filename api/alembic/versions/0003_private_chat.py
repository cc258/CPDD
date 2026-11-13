"""chat_messages 增加收件人，支持一对一私聊

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("recipient_id", sa.Integer(), nullable=True))
    # 旧的全局聊天消息无法推断收件人，回填为发送者本人（一对一会话中不可见）
    op.execute("UPDATE chat_messages SET recipient_id = user_id WHERE recipient_id IS NULL")
    op.alter_column("chat_messages", "recipient_id", nullable=False)
    op.create_foreign_key(
        "fk_chat_messages_recipient_id_users",
        "chat_messages",
        "users",
        ["recipient_id"],
        ["id"],
    )
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"])
    op.create_index("ix_chat_messages_recipient_id", "chat_messages", ["recipient_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_recipient_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_constraint(
        "fk_chat_messages_recipient_id_users", "chat_messages", type_="foreignkey"
    )
    op.drop_column("chat_messages", "recipient_id")
