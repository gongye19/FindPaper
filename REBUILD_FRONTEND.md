# 重新构建前端镜像说明

## 问题原因

前端代码和nginx配置的修改需要重新构建镜像才能生效，因为：
1. 前端代码是在构建时打包的（npm run build）
2. nginx配置是在构建时复制的（COPY nginx.conf）

## 解决方案

重新构建前端镜像：

```bash
cd /Users/han/Desktop/code/ideas/find_paper
docker-compose build frontend
docker-compose up -d frontend
```

或者直接重建并启动：

```bash
docker-compose up -d --build frontend
```

## 已修改的内容

1. **frontend/nginx.conf**: server_name改为0.0.0.0，添加了超时设置
2. **frontend/App.tsx**: API地址逻辑改为始终使用相对路径
3. **frontend/Dockerfile**: VITE_API_URL默认值改为0.0.0.0:8000
4. **docker-compose.yml**: 环境变量和构建参数更新

## 验证

重新构建后，访问 http://0.0.0.0:3000 或 http://127.0.0.1:3000 应该可以正常工作。
