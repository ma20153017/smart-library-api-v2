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
      version: "2.3.1",
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
    
    // 第一步：从数据库搜索相关图书
    console.log(`🔍 [V2.3] 开始搜索候选书籍，查询: "${searchQuery}"`);
    const candidateResult = await searchCandidateBooks(searchQuery, limitNum * 3, keywordResult);
    
    // 🚀 提取候选书籍和路径信息
    const { books: candidateBooks, isFromFastMapping, processingPath } = candidateResult;
    
    console.log(`📚 [V2.3] 候选书籍搜索结果: ${candidateBooks.length} 本书`);
    console.log(`📊 [V2.3] 处理路径: ${processingPath}`);
    
    if (candidateBooks.length > 0) {
      console.log(`📖 [V2.3] 示例候选书籍: ${candidateBooks[0].title} (ID: ${candidateBooks[0].id}, 分类: ${candidateBooks[0].subject})`);
    }
    
    if (candidateBooks.length === 0) {
      console.log(`❌ [V2] 未找到候选书籍，返回空推荐`);
      result = {
        summary: "抱歉，我们的图书馆中没有找到与您查询相关的书籍",
        recommendations: []
      };
      await setCache(cacheKey, result, 300);
      return res.status(200).json(result);
    }
    
    // 🚀 第二步：根据处理路径选择推荐策略
    let aiRecommendations;
    
    if (isFromFastMapping) {
      // ⚡ 快速路径：直接返回搜索结果，不调用AI
      console.log(`⚡ [V2.3] 快速映射路径：直接返回候选书籍，跳过AI推荐`);
      
      const selectedBooks = candidateBooks.slice(0, limitNum);
      aiRecommendations = {
        summary: `根据您的查询"${searchQuery}"，为您推荐以下${selectedBooks.length}本相关图书`,
        recommendations: selectedBooks.map(book => ({
          id: book.id,
          title: book.title,
          author: book.author,
          subject: book.subject,
          publisher: book.publisher,
          popularity: book.popularity,
          reason: `根据您的查询推荐的${book.subject}类优质图书，该书在相关领域具有较高的参考价值`,
          summary: `${book.subject} | ${book.publisher || '未知出版社'}`
        }))
      };
      
      console.log(`⚡ [V2.3] 快速路径完成，返回${aiRecommendations.recommendations.length}本推荐`);
      
    } else {
      // 🤖 AI路径：完整的AI推荐流程
      console.log(`🤖 [V2.3] AI理解路径：调用DeepSeek进行智能推荐`);
      aiRecommendations = await getAIRecommendations(searchQuery, candidateBooks, limitNum);
      console.log(`🤖 [V2.3] AI推荐完成`);
    }
    
    result = {
      summary: aiRecommendations.summary || `根据您的查询"${searchQuery}"，为您推荐以下图书`,
      recommendations: aiRecommendations.recommendations || candidateBooks.slice(0, limitNum).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        popularity: book.popularity,
        summary: `${book.subject} | ${book.publisher || '未知出版社'}`
      }))
    };
    
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
async function searchCandidateBooks(query, limit = 30, keywordResult = null) {
  try {
    if (!dbPool) {
      console.error('❌ [V2.3] 数据库连接池未初始化，无法搜索候选书籍');
      return {
        books: [],
        isFromFastMapping: false,
        processingPath: 'error'
      };
    }
    
    // 🚀 从keywordResult提取路径信息
    const { keywords, isFromFastMapping, processingPath } = keywordResult || {
      keywords: [],
      isFromFastMapping: false,
      processingPath: 'legacy'
    };
    
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
    
    // 📚 智能关键词提取 - AI双阶段处理
    async function extractKeywords(text) {
      const keywords = [];
      let foundKeywords = []; // 🚀 移到函数顶层，用于判断处理路径
      
      console.log(`🔤 [V2.3] 启动AI双阶段关键词提取，原文: "${text}"`);
      console.log(`⚡ [V2.3] 第一阶段：快速映射检测`);
      
      // 扩展的图书类别关键词映射 - 包含繁简体检测词
      const categoryMappings = {
        // 小说类 - 简体和繁体关键词都能触发
        'novel': {
          triggers: ['小说', '小說'],
          keywords: ['小说', '小說', '中國小說', '外國小說', '台灣小說', '香港小說', '言情', '武侠', '科幻']
        },
        // 儿童类
        'children': {
          triggers: ['儿童', '兒童'],
          keywords: ['儿童', '兒童', '兒童文學', '儿童文学', '童书', '童話', '童话']
        },
        // 数学类 - 关键修复！
        'math': {
          triggers: ['数学', '數學', '算术', '算術'],
          keywords: ['数学', '數學', '數學教學', '数学教学', '算術', '算术']
        },
        // 文学类
        'literature': {
          triggers: ['文学', '文學'],
          keywords: ['文学', '文學', '中國文學', '外國文學', '現代文學', '古典文學']
        },
        // 教学类
        'teaching': {
          triggers: ['教学', '教學'],
          keywords: ['教学', '教學', '教育', '學習', '学习']
        },
        // 历史类
        'history': {
          triggers: ['历史', '歷史'],
          keywords: ['历史', '歷史', '中國歷史', '世界歷史']
        },
        // 编程类
        'programming': {
          triggers: ['编程', '編程', '程序', '程式'],
          keywords: ['编程', '編程', '程序设计', '計算機', '编程', '程式', '开发']
        },
        // 计算机/电脑类 - 新增！
        'computer': {
          triggers: ['电脑', '電腦', '计算机', '計算機', '电子计算机'],
          keywords: ['電腦', '计算机', '計算機', '电子计算机', '計算機科學', '计算机科学', '資訊科學', '信息科学']
        },
        // 英语类
        'english': {
          triggers: ['英语', '英語'],
          keywords: ['英语', '英語', 'English', '英文']
        },
        // 散文类
        'prose': {
          triggers: ['散文'],
          keywords: ['散文', '随笔', '隨筆']
        },
        // 科普类
        'science': {
          triggers: ['科普', '普及'],
          keywords: ['科普', '普及讀物', '普及读物']
        },
        // 教育类
        'education': {
          triggers: ['教育'],
          keywords: ['教育', '教學']
        },
        // 物理类
        'physics': {
          triggers: ['物理', '物理学', '物理學'],
          keywords: ['物理', '物理學', '物理学', '普及讀物']
        },
        // 化学类
        'chemistry': {
          triggers: ['化学', '化學'],
          keywords: ['化学', '化學', '普及讀物']
        },
        // 生物类
        'biology': {
          triggers: ['生物', '生物学', '生物學'],
          keywords: ['生物', '生物學', '生物学', '普及讀物']
        },
        // 医学类
        'medicine': {
          triggers: ['医学', '醫學', '医疗', '醫療'],
          keywords: ['医学', '醫學', '医疗', '醫療', '健康']
        },
        // 心理学类
        'psychology': {
          triggers: ['心理', '心理学', '心理學'],
          keywords: ['心理', '心理學', '心理学']
        },
        // 经济类
        'economics': {
          triggers: ['经济', '經濟', '金融'],
          keywords: ['经济', '經濟', '金融', '商業']
        },
        // 法律类
        'law': {
          triggers: ['法律', '法學'],
          keywords: ['法律', '法學', '法学']
        },
        // 艺术类
        'art': {
          triggers: ['艺术', '藝術', '美术', '美術'],
          keywords: ['艺术', '藝術', '美术', '美術', '绘画', '繪畫']
        },
        // 音乐类
        'music': {
          triggers: ['音乐', '音樂'],
          keywords: ['音乐', '音樂', '音樂理論']
        },
        // 哲学类
        'philosophy': {
          triggers: ['哲学', '哲學'],
          keywords: ['哲学', '哲學', '思想']
        },
        // 通用推荐
        'general': {
          triggers: ['好书', '好書', '推荐', '推薦'],
          keywords: ['小說', '文學', '教育', '兒童文學']
        }
      };
      
      // 🔧 修复后的关键词检测 - 同时支持繁简体
      for (const [category, config] of Object.entries(categoryMappings)) {
        // 检查所有触发词（繁简体都包含）
        const hasMatch = config.triggers.some(trigger => text.includes(trigger));
        if (hasMatch) {
          foundKeywords.push(...config.keywords);
          console.log(`✅ [V2] 找到关键词类别: ${category} (触发词: ${config.triggers.join('/')}) -> ${config.keywords.join(', ')}`);
        }
      }
      
      if (foundKeywords.length > 0) {
        keywords.push(...foundKeywords);
      } else {
        console.log(`🔍 [V2] 未找到预定义类别，尝试通用提取`);
        
        // 检测通用推荐词汇
        if (text.includes('好书') || text.includes('推荐') || text.includes('推薦') || 
            (text.includes('什么') && (text.includes('书') || text.includes('書')))) {
          console.log(`🌟 [V2] 检测到通用推荐查询`);
          keywords.push('小說', '文學', '教育', '兒童文學');
        }
        
        // 🚀 增强的通用关键词提取 - 支持更灵活的查询
        let cleaned = text
          .replace(/推荐|推薦|一些|几本|找|想看|需要|要|给我|帮我|的|书籍|書籍|图书|圖書|好的|优秀|经典|什么|有|类|類/g, '')
          .trim();
        
        console.log(`🧹 [V2] 清理后的文本: "${cleaned}"`);
        
        if (cleaned.length > 0) {
          // 添加原始关键词
          keywords.push(cleaned);
          
          // 智能繁简体转换
          const traditional = cleaned
            .replace(/小说/g, '小說')
            .replace(/儿童/g, '兒童')
            .replace(/数学/g, '數學')
            .replace(/文学/g, '文學')
            .replace(/历史/g, '歷史')
            .replace(/教学/g, '教學')
            .replace(/语言/g, '語言')
            .replace(/电脑/g, '電腦')
            .replace(/计算机/g, '計算機')
            .replace(/物理/g, '物理學')
            .replace(/化学/g, '化學')
            .replace(/生物/g, '生物學')
            .replace(/医学/g, '醫學')
            .replace(/心理/g, '心理學')
            .replace(/经济/g, '經濟')
            .replace(/艺术/g, '藝術')
            .replace(/音乐/g, '音樂')
            .replace(/哲学/g, '哲學');
          
          if (traditional !== cleaned) {
            keywords.push(traditional);
          }
          
          // 🆕 智能关键词扩展 - 为通用词汇添加相关变体
          const expansions = {
            '技术': ['技術', '科技', '科學'],
            '科学': ['科學', '科技', '普及讀物'],
            '工具': ['工具書', '手册', '手冊'],
            '管理': ['管理學', '企業管理'],
            '设计': ['設計', '设计学'],
            '网络': ['網絡', '网络技术'],
            '软件': ['軟件', '软件工程'],
            '社会': ['社會', '社会学'],
            '政治': ['政治學', '政治学'],
            '地理': ['地理學', '地理学']
          };
          
          for (const [key, variants] of Object.entries(expansions)) {
            if (cleaned.includes(key) || traditional.includes(key)) {
              keywords.push(...variants);
              console.log(`🔄 [V2] 扩展关键词: ${key} -> ${variants.join(', ')}`);
            }
          }
        }
        
        // 🚀 第二阶段：AI智能理解（关键词映射失败时启动）
        if (keywords.length === 0) {
          console.log(`🤖 [V2] 第一阶段失败，启动AI智能理解`);
          
          // 尝试AI关键词理解
          const aiKeywords = await aiUnderstandQuery(text);
          if (aiKeywords.length > 0) {
            keywords.push(...aiKeywords);
            console.log(`✨ [V2] AI智能理解成功，生成${aiKeywords.length}个关键词`);
          } else {
            console.log(`❌ [V2] AI智能理解失败，使用默认策略`);
            // AI失败时的最后备选策略
            keywords.push('小說', '教育', '文學', '兒童文學');
          }
        } else {
          console.log(`⚡ [V2] 第一阶段成功，找到${keywords.length}个关键词`);
        }
      }
      
      console.log(`🎯 [V2.3] 最终提取的关键词: [${keywords.join(', ')}]`);
      
      // 🚀 返回关键词和路径信息
      const isFromFastMapping = foundKeywords.length > 0; // 是否来自快速映射
      
      console.log(`📍 [V2.3] 处理路径: ${isFromFastMapping ? '⚡ 快速映射' : '🤖 AI理解'}`);
      
      return {
        keywords: keywords,
        isFromFastMapping: isFromFastMapping,
        processingPath: isFromFastMapping ? 'fast_mapping' : 'ai_understanding'
      };
    }
    
    const keywordResult = await extractKeywords(query);
    const { keywords, isFromFastMapping, processingPath } = keywordResult;
    
    console.log(`🔍 [V2.3] 搜索候选书籍: "${query}" -> 关键词: [${keywords.join(', ')}]`);
    console.log(`📊 [V2.3] 处理路径: ${processingPath}`);
    
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
    
    // 🚀 返回候选书籍和处理路径信息
    return {
      books: result.rows,
      isFromFastMapping: isFromFastMapping,
      processingPath: processingPath
    };
    
  } catch (error) {
    console.error('[V2.3] 搜索候选图书错误:', error);
    return {
      books: [],
      isFromFastMapping: false,
      processingPath: 'error'
    };
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
