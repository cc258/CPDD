# CPDD

# 快速开始

## 方式一：Docker Compose 一键启动后端

```bash
docker compose up --build
```

启动后：

- API 服务：http://localhost:8000
- 接口文档（Swagger UI）：http://localhost:8000/docs

## 方式二：本地开发

1. 启动依赖服务（PostgreSQL + Redis）：

```bash
docker compose up -d db redis
```

2. 启动后端：

```bash
cd api
uv sync                       # 安装依赖
uv run alembic upgrade head   # 执行数据库迁移
uv run uvicorn app.main:app --reload
```

3. 启动前端（fe 和 admin 同时启动）：

```bash
cd web
pnpm install
pnpm dev
```

- 用户端：http://localhost:5173
- 管理后台：http://localhost:5174


> 测试账号（密码均为 ``）：

| 角色 | 账号 |
| --- | --- |
| 超级管理员 | `admin` |
| 管理员 | `aa`、`bb`、`cc`、`dd` |
| 普通用户 | `Kaselin`、`Charlie`、`Kiyo`、`Yumi` |

管理员和 VIP 角色可由超级管理员在管理后台设置。


# Features

应用分成2个部分，分别是：
1. 前端
2. 后端

对应目录分别是：
1. 前端：`/web`
2. 后端：`/api`

# 前端

前端有 2 个部分，使用pnpm monorepo 管理，目录分别是：
1. 前端应用：目录是 `/web/fe`，是一个基于 React + JavaScript 的单页应用, 模仿微信的界面，支持用户登录、注册、聊天、文件上传下载等功能。
2. 前端管理：目录是 `/web/admin`，是一个基于 React + JavaScript 的单页应用，用于管理用户、文件等。

技术栈:
- React
- JavaScript
- Axios
- Jotai
- React Router
- vite


应用页面如下：
1. 登录页
2. 主页
3. 详情页

管理页面如下：
1. 登录页
2. 主页
3. 详情页


# 后端

后端部分是一个基于 FastAPI 的 RESTful API。

技术栈如下：
- FastAPI
- uvicorn
- uv
- Python 3.14.5
- SQLALchemy 2.0
- PostgreSQL
- WebSocket
- Redis
- JWT
- Alembic
- CORS
- OpenAPI
- Docker
- Compose
- Jupyter Notebook


后端接口如下：
1. 登录接口
2. 注册接口
3. 获取用户列表接口
4. 获取用户详情接口
5. 新增用户接口
6. 编辑用户接口
7. 删除用户接口
8. 上传文件接口
9. 下载文件接口
10. 获取文件列表接口
11. 获取文件详情接口
12. 新增文件接口
13. 编辑文件接口
14. 删除文件接口
15. 聊天接口（WebSocket，按用户一对一投递）
16. 获取聊天记录接口（按对方用户过滤）


# 目录树

```text
CPDD/
├── web/                        # 前端 pnpm monorepo
│   ├── fe/                     # 用户端（仿微信聊天 SPA，端口 5173）
│   │   └── src/
│   │       ├── api/            # axios 实例、WebSocket 封装
│   │       ├── store/          # Jotai 状态（登录态）
│   │       └── pages/          # 登录页 / 主页（会话列表）/ 详情页（聊天窗口）
│   └── admin/                  # 管理后台 SPA（端口 5174）
│       └── src/
│           ├── api/            # axios 实例
│           ├── store/          # Jotai 状态（登录态）
│           └── pages/          # 登录页 / 主页（用户、文件管理）/ 详情页（用户编辑）
├── api/                        # 后端 FastAPI
│   ├── app/
│   │   ├── main.py             # 应用入口（CORS、路由注册）
│   │   ├── config.py           # 配置（数据库、Redis、JWT）
│   │   ├── db.py               # SQLAlchemy async 引擎/会话
│   │   ├── redis.py            # Redis 客户端（会话缓存）
│   │   ├── security.py         # 密码哈希、JWT 签发/校验
│   │   ├── deps.py             # 登录/管理员依赖
│   │   ├── models.py           # User / FileRecord / ChatMessage
│   │   ├── schemas.py          # Pydantic 模型
│   │   └── routers/            # auth / users / files / chat(WebSocket)
│   ├── alembic/                # 数据库迁移
│   ├── notebooks/              # Jupyter Notebook
│   ├── Dockerfile
│   └── pyproject.toml          # uv 管理依赖
├── docker-compose.yml          # 编排 api + PostgreSQL + Redis
└── readme.md
```



# Updates

加入 tailwindcss 依赖

1. 登录界模仿微信，登录面板大小也尽量大气一些，加上 注册用户，忘记密码，二维码登录等等。
2. 应用有超级管理员，管理员，普通用户，VIP用户角色，对应后续不同权限的配置。
3. 聊天界面应该是有自己头像和对方头像，和微信一模一样，用户的聊天内容应该是有区别的。

处理：
聊天信息界面刷新后，应该保持聊天时左右的排版。

4. 可以添加用户【机器人】他其实是虚拟用户，增加趣味性，预设相互之间的对话，并将对话巧妙地加入彼此的聊天过程中，比如将自己的回复默认写在输入框，当用户点击发送按钮时，将回复发送给对方，同时将【机器人】的回复也发送给对方，将用户设定的【机器人】放在添加好友的公共区域，类似一个大厅展示页面，方便其他用户也能添加。


机器人所有信息尽量模仿真人信息，都不要特别对待，只是名字后面有个Emoji小红花标明。
点击开始聊天，换成最近最后一句对话，并且是一行内文字。
把管理员等等信息都去掉，
加载用户列表时，应该按照最近对话排序


把大厅功能改成，添加好友，只有自己和管理员能看到，并且页面宽度都保持统一，不要变化页面宽度，把小助手改个名字，添加好友的页面里还有其他在线用户


有信息丢失的问题，对话不一定是来回，有可能他连续说了很多句，比如只填写了左边对话，那么可以认为是不同时间，连续发送的消息，而不要直接丢失。




# Publish to Server

CPDD_ADMIN_PATH: /var/www/html/CPDD/admin
CPDD_FE_PATH: /var/www/html/CPDD/fe