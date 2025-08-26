# 智能图书馆高性能API - V2

## 📚 项目简介

这是智能图书馆API的全新部署版本，支持：

- ✅ PostgreSQL数据库 (35,888本图书)
- ✅ Redis缓存加速
- ✅ AI智能推荐 (DeepSeek)
- ✅ 全文搜索
- ✅ 繁简体中文支持

## 🚀 版本信息

- **版本**: 2.1.0
- **部署**: v2-fresh-deploy
- **构建日期**: 2025-08-26

## 🔧 API端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/` | GET | API信息和统计 |
| `/test` | GET/POST | 测试API连接 |
| `/stats` | GET | 数据库统计信息 |
| `/search` | GET/POST | 图书搜索 |
| `/recommend` | POST | AI智能推荐 |
| `/query` | POST | 图书详情查询 |

## 🌐 环境变量需求

- `DATABASE_URL`: PostgreSQL连接字符串
- `REDIS_URL`: Redis连接字符串  
- `DEEPSEEK_API_KEY`: DeepSeek AI API密钥

## 📝 部署说明

1. 将此目录部署到Vercel
2. 在Vercel Dashboard配置环境变量
3. 连接PostgreSQL和Redis数据库
4. 测试API功能

## 🎯 预期结果

成功部署后，API根端点应返回：

```json
{
  "api": "智能图书馆高性能API",
  "version": "2.1.0",
  "database": {
    "connected": true,
    "totalBooks": 35888
  },
  "cache": {
    "connected": true
  },
  "deployment": "v2-fresh-deploy"
}
```
