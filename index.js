// 智能图书馆高性能API - v2.1
// 支持PostgreSQL数据库 + Redis缓存 + AI智能推荐
// 全新部署版本 - 2025.08.26

const axios = require('axios');
const { Pool } = require('pg');
const Redis = require('ioredis');

// 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'sk-546598dba68f4a92a2616461baf23231';
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

// 调试环境变量
console.log('🔍 [V2] 环境变量检查:');
console.log('DATABASE_URL存在:', !!DATABASE_URL);
console.log('REDIS_URL存在:', !!REDIS_URL);
console.log('DEEPSEEK_API_KEY存在:', !!DEEPSEEK_API_KEY);
if (DATABASE_URL) {
  console.log('DATABASE_URL前缀:', DATABASE_URL.substring(0, 20) + '...');
}

// 数据库连接池
let dbPool = null;
let redisClient = null;

// 初始化数据库连接
function initDatabase() {
  if (!dbPool && DATABASE_URL) {
    try {
      dbPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
      console.log('✅ [V2] PostgreSQL连接池已初始化');
    } catch (error) {
      console.error('❌ [V2] PostgreSQL连接池初始化失败:', error);
    }
  } else if (!DATABASE_URL) {
    console.error('❌ [V2] DATABASE_URL环境变量未设置！');
  }
}

// 初始化Redis连接
function initRedis() {
  if (!redisClient && REDIS_URL) {
    redisClient = new Redis(REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
    console.log('✅ [V2] Redis客户端已初始化');
  }
}

// 缓存键生成
function getCacheKey(type, ...params) {
  return `library:${type}:${params.join(':')}`;
}

// 从缓存获取数据
async function getFromCache(key, defaultTTL = 300) {
  if (!redisClient) return null;
  
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis读取错误:', error.message);
    return null;
  }
}

// 设置缓存数据
async function setCache(key, data, ttl = 300) {
  if (!redisClient) return;
  
  try {
    await redisClient.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Redis写入错误:', error.message);
  }
}

/**
 * 主API处理函数
 */
module.exports = async (req, res) => {
  try {
    // 初始化连接
    initDatabase();
    initRedis();
    
    // 处理CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 路由请求
    const path = req.url.split('?')[0].split('/').filter(Boolean)[0] || 'index';
    console.log(`📥 [V2] 请求: ${req.method} ${req.url} -> ${path}`);
    
    switch (path) {
      case 'index':
        return handleIndex(req, res);
      case 'test':
        return handleTest(req, res);
      case 'recommend':
        return handleRecommend(req, res);
      case 'query':
        return handleQuery(req, res);
      case 'search':
        return handleSearch(req, res);
      case 'stats':
        return handleStats(req, res);
      default:
        return res.status(404).json({ error: '未找到API端点' });
    }
  } catch (error) {
    console.error('[V2] API路由错误:', error);
    return res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message
    });
  }
};

/**
 * API首页信息
 */
async function handleIndex(req, res) {
  try {
    // 获取数据库统计信息
    const stats = await getDatabaseStats();
    
  return res.status(200).json({
      api: "智能图书馆高性能API",
      version: "3.0.0",
    status: "运行中",
      database: {
        connected: !!dbPool,
        totalBooks: stats.totalBooks || 0,
        languages: stats.languages || 0,
        subjects: stats.subjects || 0
      },
      cache: {
        connected: !!redisClient,
        status: redisClient ? (redisClient.status === 'ready' ? '已连接' : '连接中') : '未连接'
      },
    endpoints: [
        { path: "/", method: "GET", description: "API信息和统计" },
      { path: "/test", method: "GET,POST", description: "测试API" },
        { path: "/recommend", method: "POST", description: "AI智能图书推荐" },
        { path: "/query", method: "POST", description: "图书详情查询" },
        { path: "/search", method: "GET,POST", description: "图书搜索" },
        { path: "/stats", method: "GET", description: "数据库统计信息" }
    ],
    timestamp: new Date().toISOString(),
    deployment: "v2-fresh-deploy"
  });
  } catch (error) {
    console.error('[V2] 获取首页信息错误:', error);
    return res.status(200).json({
      api: "智能图书馆高性能API",
      version: "2.1.0",
      status: "运行中",
      error: "无法获取详细统计信息",
      deployment: "v2-fresh-deploy"
    });
  }
}

/**
 * 测试API
 */
async function handleTest(req, res) {
  const tests = [];
  
  // 测试数据库连接
  try {
    if (dbPool) {
      const result = await dbPool.query('SELECT COUNT(*) as count FROM books');
      tests.push({
        name: "数据库连接",
        status: "✅ 成功",
        details: `共 ${result.rows[0].count} 本图书`
      });
    } else {
      tests.push({
        name: "数据库连接",
        status: "❌ 失败",
        details: "数据库未配置"
      });
    }
  } catch (error) {
    tests.push({
      name: "数据库连接",
      status: "❌ 失败",
      details: error.message
    });
  }
  
  // 测试Redis连接
  try {
    if (redisClient) {
      await redisClient.ping();
      tests.push({
        name: "Redis缓存",
        status: "✅ 成功",
        details: "缓存服务可用"
      });
    } else {
      tests.push({
        name: "Redis缓存",
        status: "❌ 失败",
        details: "Redis未配置"
      });
    }
  } catch (error) {
    tests.push({
      name: "Redis缓存",
      status: "❌ 失败",
      details: error.message
    });
  }
  
  return res.status(200).json({
    success: true,
    message: "API测试完成",
    tests: tests,
    timestamp: new Date().toISOString(),
    deployment: "v2-fresh-deploy"
  });
}

/**
 * 获取数据库统计信息
 */
async function getDatabaseStats() {
  const cacheKey = getCacheKey('stats', 'overview');
  
  // 尝试从缓存获取
  let stats = await getFromCache(cacheKey);
  if (stats) {
    return stats;
  }
  
  // 从数据库查询
  try {
    if (!dbPool) {
      console.error('❌ [V2] 数据库连接池未初始化，无法获取统计信息');
      return {
        totalBooks: 0,
        languages: 0,
        subjects: 0,
        error: '数据库连接失败'
      };
    }
    
    console.log('📊 [V2] 正在查询数据库统计信息...');
    
    const queries = await Promise.all([
      dbPool.query('SELECT COUNT(*) as total FROM books'),
      dbPool.query('SELECT COUNT(DISTINCT language) as languages FROM books'),
      dbPool.query('SELECT COUNT(DISTINCT subject) as subjects FROM books WHERE subject != \'\''),
      dbPool.query('SELECT language, COUNT(*) as count FROM books GROUP BY language ORDER BY count DESC LIMIT 5'),
      dbPool.query('SELECT subject, COUNT(*) as count FROM books WHERE subject != \'\' GROUP BY subject ORDER BY count DESC LIMIT 10')
    ]);
    
    stats = {
      totalBooks: parseInt(queries[0].rows[0].total),
      languages: parseInt(queries[1].rows[0].languages),
      subjects: parseInt(queries[2].rows[0].subjects),
      languageDistribution: queries[3].rows,
      popularSubjects: queries[4].rows,
      lastUpdated: new Date().toISOString()
    };
    
    console.log(`📊 [V2] 统计信息查询成功: ${stats.totalBooks} 本图书`);
    
    // 缓存30分钟
    await setCache(cacheKey, stats, 1800);
    return stats;
    
  } catch (error) {
    console.error('❌ [V2] 获取统计信息错误:', error);
    return {
      totalBooks: 0,
      languages: 0,
      subjects: 0,
      error: error.message
    };
  }
}

/**
 * 统计信息API
 */
async function handleStats(req, res) {
  try {
    const stats = await getDatabaseStats();
    return res.status(200).json({
      success: true,
      data: stats,
      deployment: "v2-fresh-deploy"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * 图书搜索API
 */
async function handleSearch(req, res) {
  try {
    const { q: query, page = 1, limit = 20, language, subject } = req.method === 'GET' ? req.query : req.body;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供搜索关键词'
      });
    }
    
    const searchQuery = query.trim();
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;
    
    // 构建缓存键
    const cacheKey = getCacheKey('search', searchQuery, pageNum, limitNum, language || '', subject || '');
    
    // 尝试从缓存获取
    let result = await getFromCache(cacheKey);
    if (result) {
      return res.status(200).json(result);
    }
    
    // 构建SQL查询 - 支持繁简体中文
    let sql = `
      SELECT id, title, author, publisher, subject, language, popularity, view_count
      FROM books 
      WHERE (
        title ILIKE $1 OR 
        author ILIKE $1 OR 
        subject ILIKE $1 OR
        publisher ILIKE $1 OR
        title ILIKE $2 OR 
        author ILIKE $2 OR 
        subject ILIKE $2 OR
        publisher ILIKE $2
      )
    `;
    
    // 创建简繁体转换（把用户输入的简体转换成繁体来匹配数据库）
    const traditionalTerms = searchQuery
      .replace(/小说/g, '小說')
      .replace(/儿童/g, '兒童')
      .replace(/数学/g, '數學')  
      .replace(/历史/g, '歷史')
      .replace(/编程/g, '編程')
      .replace(/电脑/g, '電腦')
      .replace(/语言/g, '語言')
      .replace(/文学/g, '文學')
      .replace(/教学/g, '教學');
    
    const params = [`%${searchQuery}%`, `%${traditionalTerms}%`];
    let paramIndex = 3;
    
    // 添加语言过滤
    if (language) {
      sql += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }
    
    // 添加主题过滤
    if (subject) {
      sql += ` AND subject = $${paramIndex}`;
      params.push(subject);
      paramIndex++;
    }
    
    // 排序和分页
    sql += ` ORDER BY popularity DESC, view_count DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limitNum, offset);
    
    // 执行查询
    const searchResult = await dbPool.query(sql, params);
    
    // 获取总数
    let countSql = `
      SELECT COUNT(*) as total
      FROM books 
      WHERE (
        title ILIKE $1 OR 
        author ILIKE $1 OR 
        subject ILIKE $1 OR
        publisher ILIKE $1 OR
        title ILIKE $2 OR 
        author ILIKE $2 OR 
        subject ILIKE $2 OR
        publisher ILIKE $2
      )
    `;
    
    const countParams = [`%${searchQuery}%`, `%${traditionalTerms}%`];
    let countParamIndex = 3;
    
    if (language) {
      countSql += ` AND language = $${countParamIndex}`;
      countParams.push(language);
      countParamIndex++;
    }
    
    if (subject) {
      countSql += ` AND subject = $${countParamIndex}`;
      countParams.push(subject);
    }
    
    const countResult = await dbPool.query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total);
    
    result = {
      success: true,
      data: {
        books: searchResult.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum * limitNum < total,
          hasPrev: pageNum > 1
        },
        query: searchQuery,
        filters: { language, subject }
      }
    };
    
    // 缓存5分钟
    await setCache(cacheKey, result, 300);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[V2] 搜索错误:', error);
    return res.status(500).json({
      success: false,
      error: '搜索服务暂时不可用'
    });
  }
}

/**
 * AI智能推荐API
 */
async function handleRecommend(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: '只支持POST请求' });
    }

    const { query, limit = 10 } = req.body || {};
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        error: '缺少查询参数',
        summary: "请提供查询内容以获取图书推荐",
        recommendations: []
      });
    }

    const searchQuery = query.trim();
    const limitNum = Math.min(20, Math.max(1, parseInt(limit)));
    
    console.log(`🤖 [V2] AI推荐请求: ${searchQuery}`);
    
    // 缓存键
    const cacheKey = getCacheKey('recommend', searchQuery, limitNum);
    
    // 暂时禁用缓存，避免失败结果被缓存影响用户体验
    // TODO: 后续可以改为只缓存成功的推荐结果
    let result = null; // await getFromCache(cacheKey);
    if (result && result.recommendations && result.recommendations.length > 0) {
      console.log('📦 [V2] 从缓存返回推荐结果');
      return res.status(200).json(result);
    }
    
    // 🚀 第一步：使用三层智能查询系统
    console.log(`🚀 [V3.0] 启动三层智能查询系统，查询: "${searchQuery}"`);
    const queryResult = await intelligentQueryProcessor(searchQuery);
    
    if (queryResult.success) {
      const candidateBooks = queryResult.books;
      const processingLayer = queryResult.processing_layer;
      
      console.log(`✅ [V3.0] 三层查询成功：${processingLayer}，${candidateBooks.length}本书，${queryResult.processing_time}ms`);
      
      if (candidateBooks.length > 0) {
        console.log(`📖 [V3.0] 示例书籍: ${candidateBooks[0].title} (ID: ${candidateBooks[0].id}, 分类: ${candidateBooks[0].subject})`);
      }
      
      // 🚀 根据处理层级选择推荐策略
      if (processingLayer === 'fast_mapping') {
        // ⚡ 快速映射：直接返回搜索结果，生成简单推荐
        console.log(`⚡ [V3.0] 快速映射路径：直接返回，跳过AI推荐`);
        
        const fastRecommendations = candidateBooks.slice(0, limitNum).map(book => ({
          id: book.id,
          title: book.title,
          author: book.author,
          subject: book.subject,
          publisher: book.publisher,
          popularity: book.popularity,
          reason: `根据您的查询推荐的${book.subject}类优质图书，在相关领域具有较高的参考价值和人气`,
          summary: `${book.subject} | ${book.publisher || '未知出版社'}`
        }));
        
        result = {
          summary: `根据您的查询"${searchQuery}"，为您推荐以下${fastRecommendations.length}本相关图书`,
          recommendations: fastRecommendations,
          processing_info: {
            layer: 'fast_mapping',
            processing_time: queryResult.processing_time,
            cache_info: '快速映射结果'
          }
        };
        
        console.log(`⚡ [V3.0] 快速推荐完成，${result.recommendations.length}本书，${queryResult.processing_time}ms`);
        
        // 🚀 快速映射结果长时间缓存（30分钟）
        await setCache(cacheKey, result, 1800);
        return res.status(200).json(result);
        
      } else {
        // 🧠 智能映射：使用轻量级AI推荐
        console.log(`🧠 [V3.0] 智能映射路径：使用AI推荐优化`);
        const aiRecommendations = await getAIRecommendations(searchQuery, candidateBooks, limitNum);
        
        result = {
          summary: aiRecommendations.summary || `根据您的查询"${searchQuery}"，为您推荐以下图书`,
          recommendations: aiRecommendations.recommendations || candidateBooks.slice(0, limitNum).map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            subject: book.subject,
            publisher: book.publisher,
            popularity: book.popularity,
            reason: `推荐的${book.subject}类优质图书`,
            summary: `${book.subject} | ${book.publisher || '未知出版社'}`
          })),
          processing_info: {
            layer: 'smart_mapping',
            processing_time: queryResult.processing_time,
            cache_info: '智能映射结果'
          }
        };
      }
      
    } else {
      // 🤖 第三层：AI深度理解（回退到候选书籍搜索 + AI推荐）
      console.log(`🤖 [V3.0] 进入AI深度理解路径`);
      
      const candidateBooks = await searchCandidateBooks(searchQuery, limitNum * 3);
      console.log(`📚 [V3.0] 候选书籍搜索结果: ${candidateBooks.length} 本书`);
      
      if (candidateBooks.length === 0) {
        console.log(`❌ [V3.0] 所有层级都失败，返回空推荐`);
        result = {
          summary: "抱歉，我们的图书馆中没有找到与您查询相关的书籍",
          recommendations: []
        };
        await setCache(cacheKey, result, 300);
        return res.status(200).json(result);
      }
      
      console.log(`🤖 [V3.0] 使用AI深度推荐`);
      const aiRecommendations = await getAIRecommendations(searchQuery, candidateBooks, limitNum);
      
      result = {
        summary: aiRecommendations.summary || `根据您的查询"${searchQuery}"，为您推荐以下图书`,
        recommendations: aiRecommendations.recommendations || candidateBooks.slice(0, limitNum).map(book => ({
          id: book.id,
          title: book.title,
          author: book.author,
          subject: book.subject,
          publisher: book.publisher,
          popularity: book.popularity,
          reason: `推荐的${book.subject}类优质图书`,
          summary: `${book.subject} | ${book.publisher || '未知出版社'}`
        })),
        processing_info: {
          layer: 'ai_understanding',
          processing_time: '计算中...',
          cache_info: 'AI深度理解结果'
        }
      };
    }
    
    // 只缓存成功的推荐结果（有推荐书籍的结果）
    if (result.recommendations && result.recommendations.length > 0) {
      console.log(`💾 [V2] 缓存成功的推荐结果: ${result.recommendations.length}本书`);
      await setCache(cacheKey, result, 600); // 缓存10分钟
    } else {
      console.log(`🚫 [V2] 不缓存失败的推荐结果`);
    }
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[V2] 推荐服务错误:', error);
    return res.status(500).json({ 
      error: '推荐服务暂时不可用',
      summary: "抱歉，推荐服务遇到问题，请稍后重试",
      recommendations: []
    });
  }
}

/**
 * 搜索候选图书
 */
async function searchCandidateBooks(query, limit = 30) {
  try {
    if (!dbPool) {
      console.error('❌ [V2.3] 数据库连接池未初始化，无法搜索候选书籍');
      return [];
    }
    
    // 🤖 AI智能关键词理解 - 第二阶段处理（带缓存）
    async function aiUnderstandQuery(userQuery) {
      if (!DEEPSEEK_API_KEY) {
        console.log(`⚠️  [V2] DeepSeek API Key未配置，跳过AI理解`);
        return [];
      }
      
      // 🚀 缓存机制：检查是否已经理解过相同的查询
      const cacheKey = getCacheKey('ai_keywords', userQuery.toLowerCase().trim());
      let cachedResult = await getFromCache(cacheKey);
      
      if (cachedResult && Array.isArray(cachedResult)) {
        console.log(`📦 [V2] AI理解缓存命中: "${userQuery}" -> [${cachedResult.join(', ')}]`);
        return cachedResult;
      }
      
      console.log(`🤖 [V2] 启动AI关键词理解: "${userQuery}"`);
      
      const aiKeywordPrompt = `你是图书馆智能助手，需要将用户的图书查询转换为数据库搜索关键词。

用户查询："${userQuery}"

请分析用户的查询意图，生成适合在图书数据库中搜索的关键词。

要求：
1. 生成3-8个相关的中文关键词（包含繁体字变体）
2. 考虑同义词、相关概念、学科分类
3. 优先使用图书分类中常见的术语
4. 如果是技术类查询，包含繁体字版本

返回JSON格式：
{
  "intent": "用户查询意图总结",
  "keywords": ["关键词1", "关键词2", "..."],
  "explanation": "为什么选择这些关键词"
}

示例：
查询："推荐人工智能的书"
返回：{
  "intent": "寻找人工智能相关技术书籍",
  "keywords": ["人工智能", "機器學習", "深度學習", "計算機科學", "AI", "算法"],
  "explanation": "涵盖AI核心概念和相关技术领域"
}`;

      try {
        const response = await axios({
          method: 'post',
          url: 'https://api.deepseek.com/v1/chat/completions',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
          },
          data: {
            model: "deepseek-chat",
            messages: [
              { role: "system", content: aiKeywordPrompt },
              { role: "user", content: `请为查询"${userQuery}"生成搜索关键词` }
            ],
            temperature: 0.3, // 较低温度确保稳定输出
            max_tokens: 800
          },
          timeout: 15000
        });
        
        if (response.data?.choices?.[0]?.message?.content) {
          try {
            const aiResult = JSON.parse(response.data.choices[0].message.content);
            const keywords = aiResult.keywords || [];
            
            console.log(`🧠 [V2] AI理解意图: ${aiResult.intent}`);
            console.log(`🔍 [V2] AI生成关键词: [${keywords.join(', ')}]`);
            console.log(`💡 [V2] AI解释: ${aiResult.explanation}`);
            
            // 💾 缓存AI理解结果（30分钟）
            if (keywords.length > 0) {
              await setCache(cacheKey, keywords, 1800); // 30分钟缓存
              console.log(`💾 [V2] AI理解结果已缓存`);
            }
            
            return keywords;
          } catch (parseError) {
            console.error(`❌ [V2] AI返回JSON解析失败:`, parseError);
            return [];
          }
        } else {
          console.error(`❌ [V2] AI API返回异常`);
          return [];
        }
      } catch (error) {
        console.error(`❌ [V2] AI关键词理解失败:`, error.message);
        return [];
      }
    }
    
    // 🚀 三层智能查询系统 - 速度优化版本
    async function intelligentQueryProcessor(text) {
      console.log(`🚀 [V3.0] 启动三层智能查询，原文: "${text}"`);
      
      // 🏃 第1层：超级快速映射（目标：直接返回结果）
      const fastResult = await fastMappingLayer(text);
      if (fastResult.success) {
        console.log(`⚡ [V3.0] 第1层成功：快速映射直接返回结果`);
        return { 
          success: true, 
          books: fastResult.books, 
          processing_layer: 'fast_mapping',
          processing_time: fastResult.time
        };
      }
      
      // 🧠 第2层：智能关键词扩展
      const smartResult = await smartMappingLayer(text);
      if (smartResult.success) {
        console.log(`🧠 [V3.0] 第2层成功：智能关键词扩展`);
        return { 
          success: true, 
          books: smartResult.books, 
          processing_layer: 'smart_mapping',
          processing_time: smartResult.time
        };
      }
      
      // 🤖 第3层：AI深度理解（保留原有逻辑作为最后备选）
      console.log(`🤖 [V3.0] 进入第3层：AI深度理解`);
      return { 
        success: false, 
        books: [], 
        processing_layer: 'ai_understanding',
        keywords: smartResult.keywords || []
      };
    }
    
    // ⚡ 第1层：超级快速映射
    async function fastMappingLayer(text) {
      const startTime = Date.now();
      
      // 直接匹配热门查询
      const directMatches = {
        '推荐小说': { subject: '小說', fallback: ['中國小說', '外國小說', '台灣小說'] },
        '推荐小說': { subject: '小說', fallback: ['中國小說', '外國小說', '台灣小說'] },
        '推荐数学书籍': { subject: '數學', fallback: ['數學教學', '算術'] },
        '推荐數學书籍': { subject: '數學', fallback: ['數學教學', '算術'] },
        '推荐儿童读物': { subject: '兒童文學', fallback: ['兒童小說', '童書'] },
        '推荐兒童读物': { subject: '兒童文學', fallback: ['兒童小說', '童書'] },
        '推荐文学类书籍': { subject: '文學', fallback: ['中國文學', '外國文學'] },
        '推荐文學类书籍': { subject: '文學', fallback: ['中國文學', '外國文學'] },
        '推荐电脑类书籍': { subject: '電腦', fallback: ['計算機', '計算機科學'] },
        '推荐電腦类书籍': { subject: '電腦', fallback: ['計算機', '計算機科學'] },
        '推荐计算机书籍': { subject: '電腦', fallback: ['計算機', '計算機科學'] },
        '推荐計算機书籍': { subject: '電腦', fallback: ['計算機', '計算機科學'] },
        '推荐教育类书籍': { subject: '教育', fallback: ['教學', '文化、科學、教育、體育'] }
      };
      
      if (directMatches[text]) {
        const match = directMatches[text];
        const books = await fastDatabaseQuery(match.subject, match.fallback, 10);
        
        if (books.length > 0) {
          const time = Date.now() - startTime;
          console.log(`⚡ [V3.0] 直接匹配成功：${match.subject}，${books.length}本书，${time}ms`);
          return { success: true, books, time };
        }
      }
      
      // 模式匹配
      const patterns = [
        { regex: /推荐(.+?)[类類]?书籍?/, handler: (match) => extractCategoryFromPattern(match[1]) },
        { regex: /(.+?)[类類]?书籍?推荐/, handler: (match) => extractCategoryFromPattern(match[1]) },
        { regex: /找(.+?)书/, handler: (match) => extractCategoryFromPattern(match[1]) }
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern.regex);
        if (match) {
          const category = pattern.handler(match);
          if (category) {
            const books = await fastDatabaseQuery(category.subject, category.fallback, 10);
            if (books.length > 0) {
              const time = Date.now() - startTime;
              console.log(`⚡ [V3.0] 模式匹配成功：${category.subject}，${books.length}本书，${time}ms`);
              return { success: true, books, time };
            }
          }
        }
      }
      
      return { success: false };
    }
    
    // 🧠 第2层：智能关键词扩展
    async function smartMappingLayer(text) {
      const startTime = Date.now();
      
      // 概念映射（现代概念 → 传统图书分类）
      const conceptMapping = {
        '人工智能': ['計算機', '數學', '計算機科學'],
        'AI': ['計算機', '數學', '計算機科學'],
        '机器学习': ['計算機', '數學', '統計學'],
        '网站开发': ['計算機', '電腦', '程序設計'],
        '网页设计': ['計算機', '電腦', '程序設計'],
        '做网站': ['計算機', '電腦', '程序設計'],
        '创业': ['企業管理', '商業', '經濟'],
        '投资理财': ['經濟學', '金融', '商業'],
        '理财': ['經濟學', '金融', '商業'],
        '好书': ['小說', '文學', '教育', '兒童文學'],
        '推荐': ['小說', '文學', '教育', '兒童文學']
      };
      
      // 检查概念映射
      for (const [concept, categories] of Object.entries(conceptMapping)) {
        if (text.includes(concept)) {
          console.log(`🧠 [V3.0] 概念映射：${concept} -> ${categories.join(', ')}`);
          
          for (const category of categories) {
            const books = await fastDatabaseQuery(category, [], 8);
            if (books.length > 0) {
              const time = Date.now() - startTime;
              console.log(`🧠 [V3.0] 概念映射成功：${category}，${books.length}本书，${time}ms`);
              return { success: true, books, time, keywords: categories };
            }
          }
        }
      }
      
      // 意图识别
      const intentPatterns = [
        { regex: /(学.*做|想.*做|如何.*做).*网站/, categories: ['計算機', '電腦'] },
        { regex: /(什么|有.*)(好书|好書)/, categories: ['小說', '文學', '教育'] },
        { regex: /(想.*了解|学.*|学习).*(投资|理财)/, categories: ['經濟學', '金融'] },
        { regex: /(想.*了解|学.*|学习).*(创业|商业)/, categories: ['企業管理', '商業'] }
      ];
      
      for (const pattern of intentPatterns) {
        if (pattern.regex.test(text)) {
          console.log(`🧠 [V3.0] 意图识别：${pattern.regex} -> ${pattern.categories.join(', ')}`);
          
          for (const category of pattern.categories) {
            const books = await fastDatabaseQuery(category, [], 8);
            if (books.length > 0) {
              const time = Date.now() - startTime;
              console.log(`🧠 [V3.0] 意图识别成功：${category}，${books.length}本书，${time}ms`);
              return { success: true, books, time, keywords: pattern.categories };
            }
          }
        }
      }
      
      return { success: false, keywords: [] };
    }
    
    // 🏃 快速数据库查询
    async function fastDatabaseQuery(primaryCategory, fallbackCategories = [], limit = 10) {
      if (!dbPool) return [];
      
      try {
        // 第1优先级：精确匹配
        let sql = `SELECT id, title, author, publisher, subject, language, popularity, view_count
                   FROM books WHERE subject = $1 ORDER BY popularity DESC, view_count DESC LIMIT $2`;
        let result = await dbPool.query(sql, [primaryCategory, limit]);
        
        if (result.rows.length > 0) {
          console.log(`🏃 [V3.0] 精确匹配成功：${primaryCategory}，${result.rows.length}本书`);
          return result.rows;
        }
        
        // 第2优先级：模糊匹配
        sql = `SELECT id, title, author, publisher, subject, language, popularity, view_count
               FROM books WHERE subject ILIKE $1 ORDER BY popularity DESC, view_count DESC LIMIT $2`;
        result = await dbPool.query(sql, [`%${primaryCategory}%`, limit]);
        
        if (result.rows.length > 0) {
          console.log(`🏃 [V3.0] 模糊匹配成功：${primaryCategory}，${result.rows.length}本书`);
          return result.rows;
        }
        
        // 第3优先级：回退类别
        for (const fallback of fallbackCategories) {
          result = await dbPool.query(sql, [`%${fallback}%`, Math.ceil(limit/fallbackCategories.length)]);
          if (result.rows.length > 0) {
            console.log(`🏃 [V3.0] 回退匹配成功：${fallback}，${result.rows.length}本书`);
            return result.rows;
          }
        }
        
        return [];
      } catch (error) {
        console.error(`❌ [V3.0] 快速查询错误:`, error);
        return [];
      }
    }
    
    // 🔍 从模式中提取类别
    function extractCategoryFromPattern(text) {
      const categoryMap = {
        '小说': { subject: '小說', fallback: ['中國小說', '外國小說'] },
        '小說': { subject: '小說', fallback: ['中國小說', '外國小說'] },
        '数学': { subject: '數學', fallback: ['數學教學'] },
        '數學': { subject: '數學', fallback: ['數學教學'] },
        '儿童': { subject: '兒童文學', fallback: ['兒童小說'] },
        '兒童': { subject: '兒童文學', fallback: ['兒童小說'] },
        '文学': { subject: '文學', fallback: ['中國文學', '外國文學'] },
        '文學': { subject: '文學', fallback: ['中國文學', '外國文學'] },
        '电脑': { subject: '電腦', fallback: ['計算機'] },
        '電腦': { subject: '電腦', fallback: ['計算機'] },
        '计算机': { subject: '電腦', fallback: ['計算機'] },
        '計算機': { subject: '電腦', fallback: ['計算機'] },
        '教育': { subject: '教育', fallback: ['教學'] }
      };
      
      for (const [key, value] of Object.entries(categoryMap)) {
        if (text.includes(key)) {
          return value;
        }
      }
      
      return null;
    }
    
    // 🚀 简化的 extractKeywords 函数（向后兼容）
    async function extractKeywords(text) {
      console.log(`🔤 [V3.0] 简化关键词提取: "${text}"`);
      
      const simpleMapping = {
        '小说': ['小说', '小說'],
        '小說': ['小说', '小說'],
        '数学': ['数学', '數學'],
        '數學': ['数学', '數學'],
        '儿童': ['儿童', '兒童'],
        '兒童': ['儿童', '兒童'],
        '文学': ['文学', '文學'],
        '文學': ['文学', '文學'],
        '电脑': ['电脑', '電腦', '计算机', '計算機'],
        '電腦': ['电脑', '電腦', '计算机', '計算機'],
        '计算机': ['电脑', '電腦', '计算机', '計算機'],
        '計算機': ['电脑', '電腦', '计算机', '計算機'],
        '教育': ['教育', '教學'],
        '教學': ['教育', '教學']
      };
      
      for (const [key, values] of Object.entries(simpleMapping)) {
        if (text.includes(key)) {
          return values;
        }
      }
      
      const cleaned = text.replace(/推荐|推薦|一些|几本|找|想看|需要|要|的|书籍|書籍|图书|圖書|好的|优秀|经典|什么|有|类|類/g, '').trim();
      return cleaned.length > 0 ? [cleaned] : ['小說', '教育', '文學'];
    }
    
    const keywords = await extractKeywords(query);
    
    console.log(`🔍 [V2.3] 搜索候选书籍: "${query}" -> 关键词: [${keywords.join(', ')}]`);
    
    if (keywords.length === 0) {
      console.log('⚠️  未找到有效关键词，返回热门图书');
      // 如果没有关键词，返回一些热门图书
      const sql = `SELECT id, title, author, publisher, subject, language, popularity, view_count
                   FROM books ORDER BY popularity DESC, view_count DESC LIMIT $1`;
      const result = await dbPool.query(sql, [limit]);
      return result.rows;
    }
    
    // 构建动态SQL查询
    let conditions = [];
    let params = [];
    let paramIndex = 1;
    
    for (const keyword of keywords) {
      conditions.push(`(title ILIKE $${paramIndex} OR author ILIKE $${paramIndex} OR subject ILIKE $${paramIndex} OR publisher ILIKE $${paramIndex})`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }
    
    const sql = `
      SELECT id, title, author, publisher, subject, language, popularity, view_count
      FROM books 
      WHERE ${conditions.join(' OR ')}
      ORDER BY popularity DESC, view_count DESC
      LIMIT $${paramIndex}
    `;
    
    params.push(limit);
    console.log(`🔍 [V2] 执行候选书籍查询SQL，参数数量: ${params.length}`);
    const result = await dbPool.query(sql, params);
    console.log(`📊 [V2.3] 候选书籍查询完成，结果数量: ${result.rows.length}`);
    
    return result.rows;
    
  } catch (error) {
    console.error('[V2.3] 搜索候选图书错误:', error);
    return [];
  }
}

/**
 * 获取AI推荐
 */
async function getAIRecommendations(userQuery, candidateBooks, limit = 10) {
  try {
    // 构建候选图书列表给AI参考
    const bookList = candidateBooks.slice(0, 20).map((book, index) => 
      `${index + 1}. ID:${book.id} 《${book.title}》 作者:${book.author} 分类:${book.subject} 热度:${book.popularity}`
    ).join('\n');
    
    const systemPrompt = `你是一位专业的图书馆员，根据用户查询和图书馆的真实藏书为用户推荐最合适的图书。

用户查询：${userQuery}

图书馆当前相关藏书：
${bookList}

请根据用户的查询意图，从上述真实藏书中选择最合适的${limit}本书推荐给用户。

要求：
1. 只能推荐上述列表中的图书，使用真实的ID
2. 根据相关性和质量排序
3. 为每本书提供推荐理由
4. 提供整体的推荐总结

请以JSON格式返回：
{
  "summary": "针对用户查询的总体推荐说明",
  "recommendations": [
    {
      "id": "真实的图书ID",
      "title": "图书标题",
      "author": "作者",
      "subject": "分类",
      "reason": "推荐理由(30-50字)"
    }
  ]
}`;

      const response = await axios({
        method: 'post',
        url: 'https://api.deepseek.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        data: {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
          { role: "user", content: `请为查询"${userQuery}"推荐图书` }
          ],
          temperature: 0.7,
        max_tokens: 1500
      },
      timeout: 30000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      try {
        const aiResult = JSON.parse(response.data.choices[0].message.content);
        
        // 验证推荐的图书ID是否在候选列表中，使用更宽松的匹配
        console.log(`🤖 [V2] AI返回推荐数量: ${aiResult.recommendations?.length || 0}`);
        console.log(`📚 [V2] 候选书籍数量: ${candidateBooks.length}`);
        
        let validRecommendations = [];
        
        if (aiResult.recommendations && aiResult.recommendations.length > 0) {
          validRecommendations = aiResult.recommendations.filter(rec => {
            // 尝试多种匹配方式
            const matchById = candidateBooks.some(book => book.id == rec.id);
            const matchByTitle = candidateBooks.some(book => 
              book.title && rec.title && 
              (book.title.includes(rec.title.substring(0, 10)) || rec.title.includes(book.title.substring(0, 10)))
            );
            
            if (matchById) {
              console.log(`✅ [V2] ID匹配成功: ${rec.id}`);
              return true;
            } else if (matchByTitle) {
              console.log(`✅ [V2] 标题匹配成功: ${rec.title}`);
              // 用真实的候选书籍数据替换
              const realBook = candidateBooks.find(book => 
                book.title && rec.title && 
                (book.title.includes(rec.title.substring(0, 10)) || rec.title.includes(book.title.substring(0, 10)))
              );
              if (realBook) {
                rec.id = realBook.id;
                rec.title = realBook.title;
                rec.author = realBook.author;
                rec.subject = realBook.subject;
              }
              return true;
            } else {
              console.log(`❌ [V2] 匹配失败: ID=${rec.id}, Title=${rec.title}`);
              return false;
            }
          });
        }
        
        // 如果AI验证后仍然没有有效推荐，使用候选书籍作为备选
        if (validRecommendations.length === 0 && candidateBooks.length > 0) {
          console.log(`🔄 [V2] AI验证失败，使用候选书籍作为推荐`);
          validRecommendations = candidateBooks.slice(0, limit).map(book => ({
            id: book.id,
            title: book.title,
            author: book.author,
            subject: book.subject,
            reason: `基于您的查询"${userQuery}"，这是${book.subject}类的优质图书`
          }));
        }
        
        console.log(`📋 [V2] 最终有效推荐数量: ${validRecommendations.length}`);
        
        return {
          summary: aiResult.summary || `为您推荐以下与"${userQuery}"相关的图书`,
          recommendations: validRecommendations.slice(0, limit)
        };
        
      } catch (parseError) {
        console.error('[V2] AI响应解析错误:', parseError);
      }
    }
    
    // AI失败时返回默认推荐
    return {
      summary: `根据您的查询"${userQuery}"，为您推荐以下相关图书`,
      recommendations: candidateBooks.slice(0, limit).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        reason: `${book.subject}类热门图书，适合您的需求`
      }))
    };
    
  } catch (error) {
    console.error('[V2] AI推荐错误:', error);
    return {
      summary: `为您推荐以下图书`,
      recommendations: candidateBooks.slice(0, limit).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        reason: `热门推荐图书`
      }))
    };
  }
}

/**
 * 图书详情查询API
 */
async function handleQuery(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: '只支持POST请求',
        answer: "请使用POST方法发送请求",
        book: null
      });
    }

    const { bookId, query: userQuestion, bookTitle } = req.body || {};
    
    if (!bookId && !bookTitle) {
      return res.status(400).json({ 
        error: '缺少参数',
        answer: "请提供图书ID或书名",
        book: null
      });
    }

    console.log(`📖 [V2] 图书查询: ID=${bookId}, 标题=${bookTitle}, 问题=${userQuestion}`);
    
    // 根据ID或标题查找图书
    let book = null;
    
    if (bookId) {
      // 通过ID查询
      const cacheKey = getCacheKey('book', bookId);
      book = await getFromCache(cacheKey);
      
      if (!book && dbPool) {
        const result = await dbPool.query('SELECT * FROM books WHERE id = $1', [bookId]);
        if (result.rows.length > 0) {
          book = result.rows[0];
          await setCache(cacheKey, book, 3600); // 缓存1小时
        }
      }
    } else if (bookTitle) {
      // 通过标题查询
      const cacheKey = getCacheKey('book_title', bookTitle);
      book = await getFromCache(cacheKey);
      
      if (!book && dbPool) {
        const result = await dbPool.query('SELECT * FROM books WHERE title ILIKE $1 LIMIT 1', [`%${bookTitle}%`]);
        if (result.rows.length > 0) {
          book = result.rows[0];
          await setCache(cacheKey, book, 3600);
        }
      }
    }
    
    if (!book) {
      return res.status(404).json({
        error: '图书未找到',
        answer: "抱歉，没有找到您查询的图书",
        book: null
      });
    }
    
    // 增加访问计数
    if (dbPool) {
      dbPool.query('UPDATE books SET view_count = view_count + 1 WHERE id = $1', [book.id])
        .catch(err => console.error('[V2] 更新访问计数错误:', err));
    }
    
    // 如果有具体问题，使用AI回答
    let answer = `这是关于《${book.title}》的信息`;
    
    if (userQuestion && userQuestion.trim()) {
      try {
        const aiAnswer = await getAIBookAnswer(book, userQuestion);
        answer = aiAnswer || answer;
      } catch (error) {
        console.error('[V2] AI回答错误:', error);
      }
    }
    
    // 构建返回结果
    const result = {
      success: true,
      answer: answer,
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        publisher: book.publisher,
        subject: book.subject,
        language: book.language,
        callno: book.callno,
        popularity: book.popularity,
        viewCount: book.view_count,
        status: book.status,
        summary: `${book.subject}类图书，由${book.publisher || '未知出版社'}出版`,
        lastViewed: new Date().toISOString()
      }
    };
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[V2] 图书查询错误:', error);
    return res.status(500).json({
      error: '查询服务不可用',
      answer: "抱歉，查询服务遇到问题，请稍后重试",
      book: null
    });
  }
}

/**
 * 获取AI对图书问题的回答
 */
async function getAIBookAnswer(book, question) {
  try {
    const systemPrompt = `你是一位专业的图书馆员，为用户解答关于特定图书的问题。

图书信息：
- 标题：${book.title}
- 作者：${book.author}
- 出版社：${book.publisher || '未知'}
- 分类：${book.subject}
- 语言：${book.language}
- 热度：${book.popularity}

请根据这本书的信息，专业地回答用户的问题。如果无法确定答案，请诚实说明。回答要简洁明了，一般控制在100-200字内。`;

      const response = await axios({
        method: 'post',
        url: 'https://api.deepseek.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        data: {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
          { role: "user", content: question }
          ],
          temperature: 0.7,
        max_tokens: 500
      },
      timeout: 20000
    });
    
    return response.data?.choices?.[0]?.message?.content || null;
    
  } catch (error) {
    console.error('[V2] AI回答错误:', error);
    return null;
  }
}
