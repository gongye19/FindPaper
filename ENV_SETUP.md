# 环境变量配置指南

本项目使用多个环境变量文件来管理不同服务的配置。本文档说明如何配置这些环境变量。

## 📁 环境变量文件结构

```
find_paper/
├── .env.example              # 环境变量模板（所有配置的示例）
├── backend/
│   └── .env                  # 后端环境变量
├── frontend/
│   └── .env                  # 前端环境变量
└── database/
    └── .env                  # 数据库脚本环境变量
```

## 🔧 配置步骤

### 1. 复制模板文件

```bash
# 复制模板到实际环境变量文件
cp .env.example backend/.env
cp .env.example frontend/.env
cp .env.example database/.env
```

### 2. 编辑环境变量文件

根据你的实际配置编辑各个 `.env` 文件：

#### 后端环境变量 (`backend/.env`)

**必需配置：**
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_SECRET_KEY`: Supabase Service Role Key（用于后端操作）
- `LLM_API_KEY`: LLM API 密钥
- `LLM_BASE_URL`: LLM API 基础 URL（默认：`https://api.zhizengzeng.com/v1`）
- `LLM_MODEL_NAME`: LLM 模型名称（默认：`glm-4.7`）

**可选配置：**
- `S2_API_KEY`: Semantic Scholar API 密钥（可选）
- `ROWS_EACH`: 每个 venue 返回的论文数量（默认：3）
- `SEARCH_JOURNAL`: 是否搜索期刊（默认：True）
- `SEARCH_CONFERENCE`: 是否搜索会议（默认：True）

#### 前端环境变量 (`frontend/.env`)

**必需配置：**
- `VITE_SUPABASE_URL`: Supabase 项目 URL（与后端相同）
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase Publishable Key（前端使用，不是 Service Role Key）

**可选配置：**
- `VITE_API_URL`: API 地址（本地开发时使用，Docker 中通常为空）

#### 数据库环境变量 (`database/.env`)

**必需配置：**
- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_SECRET_KEY`: Supabase Service Role Key

> **注意**：数据库脚本通常使用与后端相同的 Supabase 配置。

## 🔒 安全注意事项

1. **所有 `.env` 文件都已添加到 `.gitignore`**，不会被提交到 Git
2. **不要将包含真实密钥的 `.env` 文件提交到版本控制**
3. **Service Role Key 具有完整权限**，仅用于后端，不要在前端使用
4. **Publishable Key 可以安全地在前端使用**，但仍需配置 Row Level Security (RLS)

## 🐳 Docker 配置

在 `docker-compose.yml` 中，后端服务会自动挂载 `backend/.env`：

```yaml
volumes:
  - ./backend/.env:/app/.env:ro
```

前端服务通过构建参数传递环境变量：

```yaml
build:
  args:
    - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
    - VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
```

## 📝 环境变量加载顺序

### 后端

代码会加载 `backend/.env` 文件。

### 前端

前端使用 Vite 的环境变量系统：
- 必须以 `VITE_` 开头才能在前端代码中访问
- 在构建时注入，运行时不可更改

## 🔍 验证配置

### 检查后端配置

```bash
cd backend
python -c "from dotenv import load_dotenv; import os; load_dotenv('.env'); print('SUPABASE_URL:', os.getenv('SUPABASE_URL'))"
```

### 检查前端配置

前端环境变量会在构建时注入，可以通过浏览器控制台检查：
```javascript
console.log(import.meta.env.VITE_SUPABASE_URL)
```

## ❓ 常见问题

### Q: 为什么需要多个 `.env` 文件？

A: 不同服务（后端、前端、数据库脚本）需要不同的环境变量：
- 后端需要 Service Role Key（完整权限）
- 前端需要 Publishable Key（受限权限）
- 数据库脚本需要 Service Role Key 来执行 SQL

### Q: 可以统一到一个 `.env` 文件吗？

A: 可以，但需要修改代码以支持从项目根目录加载。当前设计允许：
- 不同服务独立配置
- 更清晰的职责分离
- 更容易管理不同环境的配置

### Q: 如何区分开发和生产环境？

A: 所有环境都使用 `.env` 文件。你可以：
- 在本地使用 `backend/.env` 配置开发环境
- 在生产服务器上使用不同的 `backend/.env` 配置
- 使用环境变量覆盖（Docker/Kubernetes 等）
- 使用不同的配置文件（如 `.env.production`），但需要修改代码加载逻辑

## 📚 相关文档

- [Supabase 文档](https://supabase.com/docs)
- [Vite 环境变量](https://vitejs.dev/guide/env-and-mode.html)
- [Python dotenv](https://pypi.org/project/python-dotenv/)

