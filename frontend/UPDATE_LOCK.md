# 更新 package-lock.json

由于添加了 `@supabase/supabase-js` 依赖，需要更新 `package-lock.json` 文件。

## 方法1：本地更新（推荐）

在本地运行：
```bash
cd frontend
npm install
```

这会更新 `package-lock.json` 文件，然后可以改回使用 `npm ci`。

## 方法2：使用 Dockerfile 中的 npm install（当前方案）

我已经修改了 Dockerfile 使用 `npm install`，这样可以自动更新 lock 文件。

如果以后想改回 `npm ci`（更快、更严格），需要先更新 lock 文件。

