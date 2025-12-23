# Supabase 用户注册与配额管理实施方案

## 📋 整体架构概览

```
前端 (React)                   后端 (FastAPI)                  Supabase
┌─────────────┐                ┌──────────────┐              ┌─────────────┐
│ Supabase    │───Auth───────> │ quota_guard  │───RPC──────> │ Postgres    │
│ Auth (JWT)  │                │ 中间件       │              │ + Auth      │
│             │                │              │              │             │
│ fetch SSE   │───Bearer─────> │ /v1/paper_   │              │ profiles    │
│ + X-Anon-Id │   Token        │ search       │              │ user_usage  │
└─────────────┘                └──────────────┘              │ anon_usage  │
                                                              └─────────────┘
```

## 🎯 配额规则

| 用户类型 | 配额 | 说明 |
|---------|------|------|
| 游客（未登录） | 3次 | 使用 `X-Anon-Id` header 识别 |
| 登录用户（free） | 50次 | 使用 `Authorization: Bearer <token>` 识别 |
| 订阅用户（pro） | 无限 | 从 `profiles.plan` 判断 |

---

## 📝 实施步骤

### 阶段1: Supabase 数据库设置（需要你手动执行）

#### 1.1 创建表结构

在 Supabase Dashboard → SQL Editor 中执行以下 SQL：

**表1: `profiles`** - 存储用户计划
- `user_id` (uuid, primary key, references auth.users)
- `plan` (text: 'free' | 'pro', default 'free')
- `created_at`, `updated_at`

**表2: `user_usage`** - 登录用户使用计数
- `user_id` (uuid, primary key, references auth.users)
- `used_count` (integer, default 0)
- `updated_at`

**表3: `anon_usage`** - 游客使用计数
- `anon_id` (uuid, primary key)
- `used_count` (integer, default 0)
- `created_at`, `updated_at`

#### 1.2 创建 RPC 函数（原子操作）

**函数1: `consume_user_quota(user_id uuid)`**
- 检查 `profiles.plan`，如果是 'pro' 返回 999999（无限）
- 否则检查 `user_usage.used_count < 50`
- 如果不足，返回 -1
- 如果足够，原子更新 `used_count = used_count + 1`，返回剩余次数

**函数2: `consume_anon_quota(anon_id uuid)`**
- 检查 `anon_usage.used_count < 3`
- 如果不足，返回 -1
- 如果足够，原子更新 `used_count = used_count + 1`，返回剩余次数
- 如果 `anon_id` 不存在，自动创建记录

#### 1.3 设置 Row Level Security (RLS)

- `profiles`: 用户只能读自己的记录
- `user_usage`: 用户只能读自己的记录
- `anon_usage`: 不需要 RLS（后端用 service_role 访问）

---

### 阶段2: 后端实现（FastAPI）

#### 2.1 安装依赖

```bash
pip install supabase python-jose[cryptography]  # JWT 验证
```

#### 2.2 环境变量配置

在 `backend/.env.dev` 或 `backend/.env` 中添加：

```env
# Supabase 配置（后端使用）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key  # ⚠️ 必须是 service_role，不是 anon key
```

#### 2.3 创建 Supabase 服务模块

新建 `backend/services/supabase_service.py`:
- 初始化 Supabase 客户端（使用 service_role key）
- 提供 JWT token 验证方法
- 提供调用 RPC 的方法

#### 2.4 创建配额检查中间件

新建 `backend/middleware/quota_guard.py`:
- 从请求 header 提取身份：
  - `Authorization: Bearer <token>` → 登录用户
  - `X-Anon-Id: <uuid>` → 游客
- 调用对应的 RPC 函数检查配额
- 如果配额不足，返回 HTTP 402/403 + JSON 错误

#### 2.5 修改 `/v1/paper_search` 端点

在 `server.py` 中：
- 在 SSE 流开始前调用 `quota_guard`
- 如果配额检查失败，立即返回错误（不开始搜索）
- 如果通过，继续原有流程

---

### 阶段3: 前端实现（React）

#### 3.1 安装依赖

```bash
cd frontend
npm install @supabase/supabase-js
```

#### 3.2 环境变量配置

在 `frontend/.env` 或构建时注入：

```env
# Supabase 配置（前端使用）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key  # ⚠️ 使用 anon key，不是 service_role
```

⚠️ **重要**: 
- 前端只能用 `publishable key`（anon key）
- 后端只能用 `service_role key`
- Vite 环境变量必须以 `VITE_` 开头

#### 3.3 创建 Supabase 客户端

新建 `frontend/services/supabase.ts`:
- 初始化 Supabase 客户端（使用 publishable key）
- 导出 `supabase` 实例

#### 3.4 创建 Auth 服务

新建 `frontend/services/auth.ts`:
- `signUp(email, password)` - 注册
- `signIn(email, password)` - 登录
- `signOut()` - 登出
- `getSession()` - 获取当前 session（包含 access_token）

#### 3.5 修改 App.tsx

**5.1 添加状态管理**
- 移除旧的 `isRegistered` 和 `trialsUsed`（改用 Supabase）
- 添加 `user` 状态（从 Supabase Auth 获取）
- 添加 `anonId` 状态（localStorage 存储 UUID）

**5.2 生成/获取 anon_id**
- 首次访问时生成 `crypto.randomUUID()`
- 存储到 `localStorage`
- 每次搜索请求带上 `X-Anon-Id` header

**5.3 修改 SSE 调用**
- 当前使用 `fetch` 读取流（✅ 已支持自定义 header）
- 添加 header 逻辑：
  ```typescript
  headers: {
    'Content-Type': 'application/json',
    ...(user ? 
      { 'Authorization': `Bearer ${session.access_token}` } : 
      { 'X-Anon-Id': anonId }
    )
  }
  ```

**5.4 处理配额错误**
- 捕获 HTTP 402/403 响应
- 解析 JSON: `{ code: "QUOTA_EXCEEDED", message: "...", remaining: 0 }`
- 显示引导弹窗：
  - 游客：引导注册（"注册后获得 50 次免费搜索"）
  - free 用户：引导订阅（"订阅后无限搜索"）

#### 3.6 创建登录/注册 UI

修改 `frontend/components/RegistrationModal.tsx`:
- 改为真实的 Supabase Auth 注册/登录
- 支持邮箱+密码注册
- 支持邮箱+密码登录
- 注册成功后自动登录

---

## 🔑 需要你提供的信息

### 1. Supabase 项目信息

请提供以下信息（从 Supabase Dashboard → Settings → API）：

```
✅ SUPABASE_URL=https://xxxxx.supabase.co
✅ SUPABASE_PUBLISHABLE_KEY=eyJhbGc...（anon public key）
✅ SUPABASE_SECRET_KEY=eyJhbGc...（service_role key，⚠️ 保密）
```

### 2. 确认配额规则

请确认以下配额设置是否正确：

```
✅ 游客（anon_id）: 3次
✅ 登录用户（free plan）: 50次  
✅ 订阅用户（pro plan）: 无限
```

### 3. 错误响应格式确认

建议的配额超额错误格式：

```json
{
  "code": "QUOTA_EXCEEDED",
  "message": "配额已用完。游客可用3次，登录后50次，订阅无限。",
  "remaining": 0
}
```

HTTP 状态码：`402 Payment Required` 或 `403 Forbidden`？

### 4. 前端 UI 偏好

- 登录/注册弹窗样式：是否保持现有的 `RegistrationModal` 风格？
- 配额显示：在 header 显示剩余次数，还是只在超额时提示？
- 订阅入口：暂时手动在 Supabase 改 plan，还是需要先做一个简单的订阅页面？

---

## 📦 文件清单（实施后）

### 新增文件

```
backend/
├── services/
│   └── supabase_service.py      # Supabase 客户端封装
├── middleware/
│   └── quota_guard.py            # 配额检查中间件

frontend/
├── services/
│   ├── supabase.ts               # Supabase 客户端
│   └── auth.ts                   # Auth 服务封装
```

### 修改文件

```
backend/
├── server.py                     # 添加 quota_guard 到 /v1/paper_search
├── requirements.txt              # 添加 supabase, python-jose
├── .env.dev                      # 添加 SUPABASE_URL, SUPABASE_SECRET_KEY

frontend/
├── App.tsx                       # 集成 Supabase Auth，修改 SSE 调用
├── components/
│   └── RegistrationModal.tsx    # 改为真实注册/登录
├── package.json                  # 添加 @supabase/supabase-js
└── .env                          # 添加 VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
```

### SQL 脚本（你手动执行）

```
supabase_setup.sql                # 建表 + RPC 函数（我会生成）
```

---

## ⚠️ 注意事项

1. **密钥安全**
   - `SUPABASE_SECRET_KEY` 只能在后端使用，绝对不能暴露到前端
   - 前端只能使用 `SUPABASE_PUBLISHABLE_KEY`（anon key）

2. **JWT 验证**
   - 后端需要验证 JWT token 的有效性
   - 可以使用 Supabase 的 `verify_jwt` 或 `python-jose`

3. **并发安全**
   - RPC 函数必须使用数据库事务保证原子性
   - 避免并发请求导致配额超扣

4. **游客 ID 持久化**
   - `anon_id` 存储在 `localStorage`，清除浏览器数据会重置
   - 这是预期行为（游客配额重置）

5. **环境变量注入**
   - Docker 构建时需要注入 `VITE_*` 变量
   - 检查 `docker-compose.yml` 和 `frontend/Dockerfile`

---

## 🚀 实施顺序建议

1. ✅ **你先提供 Supabase 项目信息**（URL + 两个 key）
2. ✅ **我生成 SQL 脚本**，你在 Supabase Dashboard 执行
3. ✅ **我实现后端**（Supabase 服务 + quota_guard + 集成到 server.py）
4. ✅ **我实现前端**（Supabase Auth + 修改 SSE 调用 + UI）
5. ✅ **测试流程**（游客 → 注册 → 登录 → 配额检查）

---

## ❓ 请确认

1. Supabase 项目是否已创建？如果未创建，我可以提供创建步骤。
2. 配额规则是否确认（游客3次，登录50次，pro无限）？
3. 错误响应格式和 HTTP 状态码是否同意？
4. 是否需要我先创建 Supabase 项目的详细步骤？

确认后我开始实施！

