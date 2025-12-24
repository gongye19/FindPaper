FROM node:20-alpine AS builder

WORKDIR /app

# 构建参数
ARG VITE_API_URL=
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=

# 复制package文件
COPY package*.json ./

# 安装依赖
# 使用 npm install 而不是 npm ci，因为 lock 文件可能未同步
RUN npm install

# 复制源代码
COPY . .

# 设置环境变量（Vite 在构建时需要这些变量）
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}

# 构建应用
RUN npm run build

# 生产环境镜像
FROM nginx:alpine

# 复制构建产物到nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
