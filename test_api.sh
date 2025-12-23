#!/bin/bash
# 测试API连接脚本

echo "=== 测试后端API ==="
echo "1. 测试后端根路径:"
curl -s http://localhost:8000/ | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8000/
echo -e "\n"

echo "2. 测试通过nginx代理访问:"
curl -s -X POST http://localhost:3000/v1/paper_search \
  -H "Content-Type: application/json" \
  -d '{"query":"test","start_year":2024,"end_year":2025,"rows_each":1}' \
  --max-time 120 \
  2>&1 | head -10

echo -e "\n=== 测试完成 ==="
