FROM node:20-alpine AS builder

WORKDIR /app

# 构建参数
ARG VITE_API_URL=

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 设置环境变量
ENV VITE_API_URL=${VITE_API_URL}

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
