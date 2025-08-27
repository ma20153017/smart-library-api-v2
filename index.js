// 智能图书馆高性能API - v3.4.2
// 支持PostgreSQL数据库 + Redis缓存 + AI智能推荐 + 全覆盖动态作者识别系统
// 正则表达式优化版本 - 2025.08.27

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
      case 'authors':
        return handleAuthors(req, res);
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
      version: "3.4.2",
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
        { path: "/stats", method: "GET", description: "数据库统计信息" },
        { path: "/authors", method: "GET", description: "作者统计分析" }
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
 * 作者统计分析API
 */
async function handleAuthors(req, res) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      sort = 'books_desc',  // books_desc, books_asc, name_asc, popularity_desc
      search = '',
      min_books = 1
    } = req.query;
    
    console.log(`📊 [Authors] 获取作者统计: page=${page}, limit=${limit}, sort=${sort}`);
    
    // 构建缓存键
    const cacheKey = getCacheKey('authors', page, limit, sort, search, min_books);
    
    // 尝试从缓存获取
    let result = await getFromCache(cacheKey);
    if (result) {
      console.log(`⚡ [Authors] 缓存命中`);
      return res.status(200).json(result);
    }
    
    if (!dbPool) {
      return res.status(500).json({
        success: false,
        error: '数据库连接不可用'
      });
    }
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const minBooks = Math.max(1, parseInt(min_books));
    const offset = (pageNum - 1) * limitNum;
    
    // 构建简化的作者统计查询 (避免复杂CTE)
    let sql;
    let queryParams;
    
    if (search) {
      // 有搜索条件的查询 - 简化版本
      sql = `
        SELECT 
          author,
          COUNT(*) as book_count,
          COUNT(DISTINCT subject) as subject_diversity,
          ROUND(AVG(popularity)::numeric, 2) as avg_popularity,
          COALESCE(SUM(view_count), 0) as total_views,
          CASE 
            WHEN COUNT(*) >= 10 THEN 'prolific'
            WHEN COUNT(*) >= 5 THEN 'established'
            WHEN COUNT(*) >= 2 THEN 'emerging'
            ELSE 'limited'
          END as author_tier,
          NULL as total_count
        FROM books 
        WHERE author IS NOT NULL 
          AND author != '' 
          AND LENGTH(TRIM(author)) >= 2
          AND author ILIKE $1
        GROUP BY author
        HAVING COUNT(*) >= $2
      `;
      queryParams = [`%${search}%`, minBooks];
    } else {
      // 无搜索条件的查询 - 简化版本
      sql = `
        SELECT 
          author,
          COUNT(*) as book_count,
          COUNT(DISTINCT subject) as subject_diversity,
          ROUND(AVG(popularity)::numeric, 2) as avg_popularity,
          COALESCE(SUM(view_count), 0) as total_views,
          CASE 
            WHEN COUNT(*) >= 10 THEN 'prolific'
            WHEN COUNT(*) >= 5 THEN 'established'
            WHEN COUNT(*) >= 2 THEN 'emerging'
            ELSE 'limited'
          END as author_tier
        FROM books 
        WHERE author IS NOT NULL 
          AND author != '' 
          AND LENGTH(TRIM(author)) >= 2
        GROUP BY author
        HAVING COUNT(*) >= $1
      `;
      queryParams = [minBooks];
    }
    
    // 添加排序
    const sortMappings = {
      'books_desc': 'ORDER BY book_count DESC, avg_popularity DESC',
      'books_asc': 'ORDER BY book_count ASC, author ASC',
      'name_asc': 'ORDER BY author ASC',
      'popularity_desc': 'ORDER BY avg_popularity DESC, book_count DESC',
      'diversity_desc': 'ORDER BY subject_diversity DESC, book_count DESC'
    };
    
    sql += ` ${sortMappings[sort] || sortMappings['books_desc']}`;
    
    // 添加分页参数
    if (search) {
      sql += ` LIMIT $3 OFFSET $4`;
      queryParams.push(limitNum, offset);
    } else {
      sql += ` LIMIT $2 OFFSET $3`;
      queryParams.push(limitNum, offset);
    }
    
    console.log(`🔍 [Authors] 执行查询: ${sql.split('\n')[1]}... 参数: ${queryParams}`);
    
    const queryResult = await dbPool.query(sql, queryParams);
    const authors = queryResult.rows;
    
    if (authors.length === 0) {
      result = {
        success: true,
        data: {
          authors: [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false
          },
          statistics: {
            totalAuthors: 0,
            searchTerm: search || null
          }
        }
      };
    } else {
      // 获取总数 - 简化版本，用查询结果长度估算
      const totalAuthors = authors.length;  // 简化：使用实际返回数量
      const totalPages = Math.ceil(totalAuthors / limitNum);
      
      // 处理作者数据
      const processedAuthors = authors.map(author => ({
        name: author.author,
        bookCount: author.book_count,
        subjectDiversity: author.subject_diversity,
        avgPopularity: parseFloat(author.avg_popularity) || 0,
        totalViews: author.total_views || 0,
        tier: author.author_tier,
        subjects: [],  // 简化：暂时为空，后续可以通过单独查询获取
        sampleBooks: [],  // 简化：暂时为空，后续可以通过单独查询获取
        description: generateAuthorTierDescription(author.author_tier, author.book_count)
      }));
      
      // 构建统计信息
      const tierCounts = processedAuthors.reduce((acc, author) => {
        acc[author.tier] = (acc[author.tier] || 0) + 1;
        return acc;
      }, {});
      
      result = {
        success: true,
        data: {
          authors: processedAuthors,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalAuthors,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          },
          statistics: {
            totalAuthors,
            tierDistribution: tierCounts,
            searchTerm: search || null,
            sortBy: sort
          }
        }
      };
    }
    
    // 缓存结果 (30分钟)
    await setCache(cacheKey, result, 1800);
    
    console.log(`✅ [Authors] 返回 ${authors.length} 个作者，总计 ${result.data.statistics.totalAuthors} 个`);
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[Authors] 获取作者统计错误:', error);
    return res.status(500).json({
      success: false,
      error: '获取作者统计失败'
    });
  }
}

/**
 * 生成作者层级描述
 */
function generateAuthorTierDescription(tier, bookCount) {
  const descriptions = {
    'prolific': `多产作家，拥有${bookCount}本著作，在文学创作领域具有丰富的作品积累`,
    'established': `知名作家，已出版${bookCount}本作品，在相关领域具有一定影响力`,
    'emerging': `新兴作家，已发表${bookCount}本作品，展现出良好的创作潜力`,
    'limited': `作家，已出版${bookCount}本作品`
  };
  
  return descriptions[tier] || descriptions['limited'];
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
    
    console.log(`🤖 [V3.1] 简化推荐请求: ${searchQuery}`);
    
    // 🔍 Step 1: 从缓存检查
    const cacheKey = getCacheKey('recommend', searchQuery, limitNum);
    const cached = await getFromCache(cacheKey);
    
    if (cached) {
      console.log(`⚡ [V3.1] 缓存命中: ${searchQuery}`);
      return res.status(200).json(cached);
    }
    
    // 🔍 Step 2: 增强的关键词提取（支持作者查询）- 动态版本 + 错误处理
    let keywordInfo;
    try {
      keywordInfo = await extractSimpleKeywords(searchQuery);
      console.log(`🔤 [V3.4] 提取结果: 类型=${keywordInfo.type}, 关键词=${keywordInfo.keywords?.join(', ')}`);
    } catch (error) {
      console.error(`❌ [V3.4] 关键词提取异常:`, error);
      // 降级到简单关键词提取
      keywordInfo = {
        type: 'general',
        keywords: [searchQuery.toLowerCase()],
        fallback: true
      };
    }
    
    // 🔍 Step 3: 处理作者查询或搜索候选图书
    let candidateBooks = [];
    let isAuthorQuery = false;
    let authorInfo = null;
    
    if (keywordInfo.type === 'author' && !keywordInfo.fallback) {
      // 👤 作者查询处理 - 使用动态查找结果
      isAuthorQuery = true;
      const authorName = keywordInfo.author;
      console.log(`👤 [V3.4] 处理动态作者查询: ${authorName} (${keywordInfo.bookCount || 'Unknown'}本书)`);
      
      try {
        candidateBooks = await queryAuthorBooks(authorName, limitNum * 2);
        
        if (candidateBooks.length > 0) {
          // 生成增强的作者推荐信息
          const recommendInfo = generateDynamicAuthorRecommendation(
            authorName, 
            candidateBooks, 
            keywordInfo.matchInfo,
            keywordInfo.authorInfo
          );
          authorInfo = recommendInfo.authorInfo;
          console.log(`📚 [V3.4] 找到作者 ${authorName} 的 ${candidateBooks.length} 本作品`);
        } else {
          console.log(`❌ [V3.4] 未找到作者 ${authorName} 的作品，降级为通用查询`);
          // 作者存在但无作品，降级为通用查询
          isAuthorQuery = false;
        }
      } catch (error) {
        console.error(`❌ [V3.4] 作者查询异常:`, error);
        // 作者查询失败，降级为通用查询
        isAuthorQuery = false;
        console.log(`🔄 [V3.4] 作者查询失败，降级为关键词查询: ${authorName}`);
        keywordInfo = {
          type: 'general',
          keywords: [authorName, searchQuery.toLowerCase()],
          fallback: true
        };
      }
    } else {
      // 📂 类别/概念查询处理
      candidateBooks = await searchCandidateBooksSimple(keywordInfo.keywords, limitNum * 2);
      console.log(`📚 [V3.1] 找到候选图书: ${candidateBooks.length}本`);
    }
    
    if (candidateBooks.length === 0) {
      const result = {
        success: false,
        message: "抱歉，我们的图书馆中没有找到与您查询相关的书籍。请尝试其他关键词。",
        books: [],
        reason: "没有找到相关图书",
        processing_info: {
          layer: "simple_search",
          path: "keyword_extraction -> database_search -> no_results"
        }
      };
      
      // 缓存空结果5分钟
      await setCache(cacheKey, result, 300);
      return res.status(200).json(result);
    }
    
    // 🔍 Step 4: 如果有AI API，尝试获取AI推荐
    let aiRecommendations = null;
    if (DEEPSEEK_API_KEY && candidateBooks.length > 0) {
      try {
        aiRecommendations = await getSimpleAIRecommendations(searchQuery, candidateBooks, limitNum);
      } catch (error) {
        console.error(`⚠️ [V3.1] AI推荐失败，使用候选书籍: ${error.message}`);
      }
    }
    
    // 🔍 Step 5: 构建推荐结果
    let finalBooks = [];
    let summary = "";
    
    if (aiRecommendations && aiRecommendations.recommendations.length > 0) {
      finalBooks = aiRecommendations.recommendations;
      summary = aiRecommendations.summary;
      console.log(`🤖 [V3.1] AI推荐成功: ${finalBooks.length}本书`);
    } else {
      // 使用候选书籍作为备选
      finalBooks = candidateBooks.slice(0, limitNum).map(book => ({
        id: book.id,
        title: book.title,
        author: book.author,
        subject: book.subject,
        reason: isAuthorQuery ? `${keywordInfo.author}的${book.subject}类作品` : `${book.subject}类相关推荐`
      }));
      
      if (isAuthorQuery && authorInfo) {
        summary = generateAuthorRecommendation(keywordInfo.author, candidateBooks, keywordInfo.matchInfo).summary;
      } else {
        summary = `为您推荐${keywordInfo.keywords.join('、')}相关的优质图书`;
      }
      console.log(`📖 [V3.1] 使用候选推荐: ${finalBooks.length}本书`);
    }
    
    const result = {
      success: true,
      books: finalBooks,
      reason: summary,
      query: searchQuery,
      processing_info: {
        layer: isAuthorQuery ? "author_recommend" : "simple_recommend",
        path: "keyword_extraction -> " + (isAuthorQuery ? "author_query" : "database_search") + " -> " + (aiRecommendations ? "ai_recommend" : "fallback_recommend"),
        keywords: keywordInfo.keywords,
        candidate_count: candidateBooks.length,
        query_type: keywordInfo.type
      }
    };
    
    // 如果是作者查询，添加作者信息
    if (isAuthorQuery && authorInfo) {
      result.author_info = authorInfo;
    }
    
    // 缓存成功结果15分钟
    await setCache(cacheKey, result, 900);
    
    console.log(`✅ [V3.1] 推荐完成: ${finalBooks.length}本书，缓存15分钟`);
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[V3.1] 推荐服务错误:', error);
    return res.status(500).json({ 
      error: '推荐服务暂时不可用',
      summary: "抱歉，推荐服务遇到问题，请稍后重试",
      recommendations: []
    });
  }
}

/**
 * 作者识别和查询功能
 */

// 基于动态分析的真实高频作者列表 (V3.3.2)
const KNOWN_AUTHORS = [
  // 超高频作者 (100+本书)
  '紀江紅', '衛斯理', '薛金星', '任志鴻', '(港)嚴沁著',
  
  // 高频作者 (50+本书)  
  '王後雄', '李朝東', '王岡', '李碧華', '周誼',
  
  // 知名作者 (20+本书)
  '古龍', '梁羽生', '莫言', '張小嫻', '黃易', '錢穆',
  '周貞雄', '周國鎮', '饒雪漫', '崔鐘雷', '萬強華',
  
  // 文学作家
  '金庸', '巴金', '老舍', '茅盾', '余华', '魯迅',
  
  // 外国作家
  '夏目漱石', '海明威', '史坦恩',
  
  // 教育机构
  '人民教育出版社', '全國政協文史委', '人民教育出版社中學語文室'
];

// 作者识别模式 (V3.4.1 - 增强版)
const AUTHOR_PATTERNS = [
  // 基础查询模式
  /我想要?看(.+?)[的]?书/,                    // "我想看鲁迅的书"
  /我想要?看(.+?)[的]?作品/,                  // "我想看余华的作品"
  /我想要?看(.+?)写[的]?/,                    // "我想看金庸写的"
  
  // 推荐模式
  /推荐(.+?)[的]?作品/,                       // "推荐莫言的作品"
  /推荐(.+?)[的]?书/,                         // "推荐老舍的书"
  /推荐(.+?)[的]?小说/,                       // "推荐余华的小说"
  
  // 询问模式
  /有没有(.+?)[的]?书/,                       // "有没有鲁迅的书"
  /有没有(.+?)[的]?小说/,                     // "有没有贾平凹的小说" 
  /有没有(.+?)[的]?作品/,                     // "有没有钱钟书的作品"
  /有(.+?)[的]?书吗/,                         // "有贾平凹的书吗" ⭐ 新增
  /有(.+?)[的]?作品吗/,                       // "有余华的作品吗" ⭐ 新增
  /有(.+?)写[的]?书吗/,                       // "有鲁迅写的书吗" ⭐ 新增
  
  // 作者主导模式
  /(.+?)写[的]?书/,                           // "鲁迅写的书"
  /(.+?)写[的]?小说/,                         // "余华写的小说" ⭐ 新增
  /(.+?)写[的]?作品/,                         // "莫言写的作品" ⭐ 新增
  /(.+?)写了什么书/,                          // "张爱玲写了什么书" ⭐ 新增
  /(.+?)的书/,                                // "金庸的书" ⭐ 新增
  /(.+?)的小说/,                              // "余华的小说" ⭐ 新增
  /(.+?)的作品/,                              // "钱钟书的作品" ⭐ 新增
  /(.+?)著[的]?/,                             // "巴金著的"
  
  // 扩展模式  
  /(.+?)[的]?作品集/,                         // "金庸的作品集"
  /(.+?)[的]?代表作/,                         // "莫言的代表作"
  /(.+?)[的]?经典/,                           // "鲁迅的经典"
  /找(.+?)[的]?书籍/,                         // "找余华的书籍"
  /(.+?)[的]?其他书/,                         // "老舍的其他书"
  
  // 喜好模式
  /喜欢(.+?)/,                                // "喜欢金庸"
  /爱看(.+?)/,                                // "爱看余华" ⭐ 新增
  
  // 查找模式  
  /找(.+?)的/,                                // "找鲁迅的" ⭐ 新增
  /搜(.+?)的/,                                // "搜莫言的" ⭐ 新增
  /查(.+?)的/                                 // "查余华的" ⭐ 新增
];

// 作者优先级分组 (基于真实书籍数量)
const AUTHOR_PRIORITY = {
  ultra_high: ['紀江紅', '衛斯理', '薛金星', '任志鴻', '(港)嚴沁著'],  // 100+本书
  high: ['王後雄', '李朝東', '王岡', '李碧華', '周誼'],                    // 50+本书
  medium: ['古龍', '梁羽生', '莫言', '張小嫻', '黃易', '錢穆'],            // 知名作家
  low: ['金庸', '巴金', '老舍', '茅盾', '余华', '魯迅', '夏目漱石', '海明威'] // 经典作家
};

/**
 * 检测查询是否为作者查询 (全覆盖动态版本)
 */
async function detectAuthorQuery(query) {
  console.log(`🔍 [Author] 动态检测作者查询: "${query}"`);
  
  const text = query.trim();
  const extractedAuthors = [];
  
  // 1. 使用正则表达式模式匹配提取可能的作者名
  for (const pattern of AUTHOR_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const possibleAuthor = match[1].trim();
      if (possibleAuthor.length >= 2 && possibleAuthor.length <= 20) {
        extractedAuthors.push({
          name: possibleAuthor,
          pattern: pattern.source,
          confidence: 'high'
        });
        console.log(`🎯 [Author] 模式匹配提取作者: "${possibleAuthor}"`);
      }
    }
  }
  
  // 2. 直接包含高频作者名的快速检查
  for (const author of KNOWN_AUTHORS) {
    if (text.includes(author)) {
      extractedAuthors.push({
        name: author,
        pattern: 'direct_contains',
        confidence: 'very_high'
      });
      console.log(`⚡ [Author] 快速匹配高频作者: ${author}`);
    }
  }
  
  // 3. 如果没有提取到作者，尝试更宽泛的匹配
  if (extractedAuthors.length === 0) {
    // 检查是否包含"作者"、"作家"、"写"等关键词
    const authorKeywords = ['作者', '作家', '写', '著', '的书', '的作品', '的小说'];
    for (const keyword of authorKeywords) {
      if (text.includes(keyword)) {
        // 尝试提取关键词前的文本作为可能的作者名
        const beforeKeyword = text.split(keyword)[0].trim();
        if (beforeKeyword.length >= 2 && beforeKeyword.length <= 10) {
          extractedAuthors.push({
            name: beforeKeyword,
            pattern: 'keyword_extraction',
            confidence: 'medium'
          });
          console.log(`🔍 [Author] 关键词提取作者: "${beforeKeyword}"`);
        }
      }
    }
  }
  
  console.log(`📋 [Author] 共提取到 ${extractedAuthors.length} 个可能的作者`);
  
  // 4. 动态查找最佳匹配作者
  if (extractedAuthors.length > 0) {
    // 按置信度排序，优先处理高置信度的提取结果
    extractedAuthors.sort((a, b) => {
      const confidenceOrder = { 'very_high': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });
    
    for (const extracted of extractedAuthors) {
      try {
        const authorMatch = await dynamicAuthorLookup(extracted.name, query);
        if (authorMatch) {
          console.log(`✅ [Author] 动态匹配成功: ${authorMatch.author} (${authorMatch.matchType})`);
          return {
            type: 'author',
            author: authorMatch.author,
            matchType: authorMatch.matchType,
            pattern: extracted.pattern,
            confidence: extracted.confidence,
            original: extracted.name !== authorMatch.author ? extracted.name : undefined,
            bookCount: authorMatch.bookCount,
            authorInfo: authorMatch.authorInfo
          };
        }
      } catch (error) {
        console.error(`❌ [Author] 动态查找异常 for ${extracted.name}:`, error);
        // 继续尝试下一个提取的作者名
        continue;
      }
    }
  }
  
  console.log(`❌ [Author] 未检测到作者查询`);
  return null;
}

/**
 * 动态作者查找 - 三层匹配策略
 */
async function dynamicAuthorLookup(candidateAuthor, originalQuery) {
  console.log(`🔍 [Dynamic] 动态查找作者: "${candidateAuthor}"`);
  
  if (!dbPool) {
    console.log(`❌ [Dynamic] 数据库连接不可用`);
    return null;
  }
  
  try {
    // 清理候选作者名
    const cleanAuthor = candidateAuthor.trim();
    if (cleanAuthor.length < 2) {
      return null;
    }
    
    // 第一层：精确匹配
    console.log(`🎯 [Dynamic] 第一层：精确匹配 "${cleanAuthor}"`);
    let sql = `
      SELECT author, COUNT(*) as book_count
      FROM books 
      WHERE author = $1
      GROUP BY author
      ORDER BY book_count DESC
      LIMIT 1
    `;
    
    let result = await dbPool.query(sql, [cleanAuthor]);
    
    if (result.rows.length > 0) {
      const author = result.rows[0];
      console.log(`✅ [Dynamic] 精确匹配成功: ${author.author} (${author.book_count}本书)`);
      
      return {
        author: author.author,
        matchType: 'exact',
        bookCount: author.book_count,
        authorInfo: await getAuthorDetailInfo(author.author, author.book_count)
      };
    }
    
    // 第二层：模糊匹配 (ILIKE)
    console.log(`🔍 [Dynamic] 第二层：模糊匹配 "%${cleanAuthor}%"`);
    sql = `
      SELECT author, COUNT(*) as book_count
      FROM books 
      WHERE author ILIKE $1
      GROUP BY author
      HAVING COUNT(*) >= 1
      ORDER BY 
        CASE 
          WHEN author ILIKE $2 THEN 1  -- 包含完整候选名的优先级最高
          WHEN author ILIKE $3 THEN 2  -- 以候选名开头的次之
          ELSE 3
        END,
        COUNT(*) DESC
      LIMIT 5
    `;
    
    result = await dbPool.query(sql, [
      `%${cleanAuthor}%`,     // 包含
      `%${cleanAuthor}%`,     // 完整包含（重复用于优先级）
      `${cleanAuthor}%`       // 开头匹配
    ]);
    
    if (result.rows.length > 0) {
      const bestMatch = result.rows[0];
      
      // 验证匹配的合理性
      const similarity = calculateAuthorSimilarity(cleanAuthor, bestMatch.author);
      if (similarity >= 0.5) {  // 相似度阈值
        console.log(`✅ [Dynamic] 模糊匹配成功: ${bestMatch.author} (${bestMatch.book_count}本书, 相似度:${similarity})`);
        
        return {
          author: bestMatch.author,
          matchType: 'fuzzy',
          bookCount: bestMatch.book_count,
          similarity: similarity,
          authorInfo: await getAuthorDetailInfo(bestMatch.author, bestMatch.book_count)
        };
      }
    }
    
    // 第三层：全文搜索 (使用繁简体转换)
    console.log(`🌐 [Dynamic] 第三层：全文搜索 "${cleanAuthor}"`);
    
    // 尝试繁简体转换
    const traditionalForm = convertToTraditional(cleanAuthor);
    const simplifiedForm = convertToSimplified(cleanAuthor);
    
    const searchTerms = [cleanAuthor];
    if (traditionalForm !== cleanAuthor) searchTerms.push(traditionalForm);
    if (simplifiedForm !== cleanAuthor) searchTerms.push(simplifiedForm);
    
    for (const searchTerm of searchTerms) {
      sql = `
        SELECT author, COUNT(*) as book_count
        FROM books 
        WHERE to_tsvector('simple', author) @@ plainto_tsquery('simple', $1)
           OR author ILIKE $2
        GROUP BY author
        HAVING COUNT(*) >= 1
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `;
      
      result = await dbPool.query(sql, [searchTerm, `%${searchTerm}%`]);
      
      if (result.rows.length > 0) {
        for (const candidate of result.rows) {
          const similarity = calculateAuthorSimilarity(cleanAuthor, candidate.author);
          if (similarity >= 0.3) {  // 较低的相似度阈值
            console.log(`✅ [Dynamic] 全文搜索成功: ${candidate.author} (${candidate.book_count}本书, 相似度:${similarity})`);
            
            return {
              author: candidate.author,
              matchType: 'fulltext',
              bookCount: candidate.book_count,
              similarity: similarity,
              authorInfo: await getAuthorDetailInfo(candidate.author, candidate.book_count)
            };
          }
        }
      }
    }
    
    console.log(`❌ [Dynamic] 未找到匹配的作者: "${candidateAuthor}"`);
    return null;
    
  } catch (error) {
    console.error(`❌ [Dynamic] 动态查找作者异常:`, error);
    return null;
  }
}

/**
 * 计算作者名相似度
 */
function calculateAuthorSimilarity(name1, name2) {
  // 简单的相似度算法
  const clean1 = name1.toLowerCase().trim();
  const clean2 = name2.toLowerCase().trim();
  
  // 精确匹配
  if (clean1 === clean2) return 1.0;
  
  // 包含关系
  if (clean1.includes(clean2) || clean2.includes(clean1)) {
    return Math.max(clean1.length, clean2.length) / Math.min(clean1.length, clean2.length) * 0.8;
  }
  
  // 字符重叠率
  const set1 = new Set(clean1);
  const set2 = new Set(clean2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  const jaccardSimilarity = intersection.size / union.size;
  
  // 长度惩罚
  const lengthDiff = Math.abs(clean1.length - clean2.length);
  const lengthPenalty = Math.exp(-lengthDiff / 10);
  
  return jaccardSimilarity * lengthPenalty;
}

/**
 * 获取作者详细信息
 */
async function getAuthorDetailInfo(authorName, bookCount) {
  try {
    // 获取作者的主要学科分布
    const subjectSql = `
      SELECT subject, COUNT(*) as count
      FROM books 
      WHERE author = $1
      GROUP BY subject
      ORDER BY count DESC
      LIMIT 5
    `;
    
    const subjectResult = await dbPool.query(subjectSql, [authorName]);
    const subjects = subjectResult.rows.map(row => row.subject);
    
    // 获取代表作 (按人气排序)
    const booksSql = `
      SELECT title, subject, popularity
      FROM books 
      WHERE author = $1
      ORDER BY popularity DESC, view_count DESC
      LIMIT 3
    `;
    
    const booksResult = await dbPool.query(booksSql, [authorName]);
    const representativeBooks = booksResult.rows.map(book => book.title);
    
    // 判断作者层级
    let tier;
    if (bookCount >= 100) tier = 'ultra_high';
    else if (bookCount >= 50) tier = 'high';
    else if (bookCount >= 10) tier = 'medium';
    else if (bookCount >= 5) tier = 'low';
    else tier = 'emerging';
    
    return {
      subjects,
      representativeBooks,
      tier,
      subjectCount: subjects.length
    };
    
  } catch (error) {
    console.error(`❌ [Dynamic] 获取作者详细信息失败:`, error);
    return {
      subjects: [],
      representativeBooks: [],
      tier: 'unknown',
      subjectCount: 0
    };
  }
}

/**
 * 简单的繁简体转换 (扩展版)
 */
function convertToTraditional(text) {
  const conversionMap = {
    '国': '國', '学': '學', '书': '書', '说': '說', '读': '讀',
    '语': '語', '历': '歷', '华': '華', '单': '單', '当': '當',
    '东': '東', '南': '南', '西': '西', '北': '北', '中': '中',
    '香': '香', '港': '港', '台': '臺', '湾': '灣', '新': '新',
    '马': '馬', '来': '來', '写': '寫', '著': '著', '作': '作',
    '家': '家', '者': '者', '人': '人'
  };
  
  return text.split('').map(char => conversionMap[char] || char).join('');
}

function convertToSimplified(text) {
  const conversionMap = {
    '國': '国', '學': '学', '書': '书', '說': '说', '讀': '读',
    '語': '语', '歷': '历', '華': '华', '單': '单', '當': '当',
    '東': '东', '南': '南', '西': '西', '北': '北', '中': '中',
    '香': '香', '港': '港', '臺': '台', '灣': '湾', '新': '新',
    '馬': '马', '來': '来', '寫': '写', '著': '著', '作': '作',
    '家': '家', '者': '者', '人': '人'
  };
  
  return text.split('').map(char => conversionMap[char] || char).join('');
}

/**
 * 查询作者的所有作品
 */
async function queryAuthorBooks(authorName, limit = 20) {
  if (!dbPool) {
    console.error('[Author] 数据库连接不可用');
    return [];
  }
  
  try {
    console.log(`📚 [Author] 查询作者 "${authorName}" 的作品，限制 ${limit} 本`);
    
    // 策略1: 精确匹配
    let sql = `
      SELECT id, title, author, publisher, subject, language, popularity, view_count
      FROM books 
      WHERE author = $1 
      ORDER BY popularity DESC, view_count DESC 
      LIMIT $2
    `;
    
    let result = await dbPool.query(sql, [authorName, limit]);
    
    if (result.rows.length > 0) {
      console.log(`🎯 [Author] 精确匹配找到 ${result.rows.length} 本书`);
      return result.rows;
    }
    
    // 策略2: 模糊匹配 (作者字段包含查询的作者名)
    sql = `
      SELECT id, title, author, publisher, subject, language, popularity, view_count
      FROM books 
      WHERE author ILIKE $1
      ORDER BY popularity DESC, view_count DESC 
      LIMIT $2
    `;
    
    result = await dbPool.query(sql, [`%${authorName}%`, limit]);
    
    if (result.rows.length > 0) {
      console.log(`🔍 [Author] 模糊匹配找到 ${result.rows.length} 本书`);
      return result.rows;
    }
    
    console.log(`❌ [Author] 未找到作者 "${authorName}" 的作品`);
    return [];
    
  } catch (error) {
    console.error('[Author] 查询作者作品错误:', error);
    return [];
  }
}

/**
 * 生成作者推荐响应
 */
function generateAuthorRecommendation(authorName, books, matchInfo) {
  const bookCount = books.length;
  const subjects = [...new Set(books.map(book => book.subject))];
  const subjectStr = subjects.slice(0, 3).join('、');
  
  let summary = '';
  let processingPath = '';
  
  if (matchInfo.matchType === 'exact') {
    summary = `为您找到${authorName}的${bookCount}本作品，主要包括${subjectStr}等类型。`;
    processingPath = 'author_exact_match -> database_query -> success';
  } else if (matchInfo.matchType === 'fuzzy') {
    summary = `为您找到${authorName}的${bookCount}本作品（您搜索的是"${matchInfo.original}"），主要包括${subjectStr}等类型。`;
    processingPath = 'author_fuzzy_match -> database_query -> success';
  } else {
    summary = `为您找到${authorName}的${bookCount}本作品，主要包括${subjectStr}等类型。`;
    processingPath = 'author_contains_match -> database_query -> success';
  }
  
  // 基于真实数据的作者特色描述 (V3.3.2)
  const authorDescriptions = {
    // 超高产作家 (100+本书)
    '紀江紅': '紀江紅是我们图书馆收藏最丰富的作家，拥有225本著作，涉及11个不同学科领域。',
    '衛斯理': '衛斯理是著名科幻小说作家，馆藏136本作品，以独特的想象力和科幻构思著称。',
    '薛金星': '薛金星是多产的教育类作家，馆藏132本作品，涉及13个学科，是教育辅导书的重要作者。',
    '任志鴻': '任志鴻是高产作家，馆藏128本作品，涉及10个学科领域，在教育出版方面贡献突出。',
    '(港)嚴沁著': '严沁是香港著名作家，馆藏141本作品，主要专注于文学创作。',
    
    // 高频作家 (50+本书)
    '王後雄': '王後雄是知名教育作家，馆藏50本作品，在教育辅导领域有重要影响。',
    '李朝東': '李朝東是多产作家，馆藏53本作品，在多个领域都有重要贡献。',
    '李碧華': '李碧華是著名女作家，馆藏42本作品，作品富有文学价值。',
    
    // 经典文学大师
    '古龍': '古龙是武侠小说三大宗师之一，以独特的武侠风格和人物塑造闻名文坛。',
    '梁羽生': '梁羽生是新派武侠小说的开创者，被誉为"新武侠小说之父"。',
    '莫言': '莫言是诺贝尔文学奖获得者，中国当代著名作家，作品具有魔幻现实主义色彩。',
    '張小嫻': '张小嫻是香港著名女作家，以情感小说著称，作品深受读者喜爱。',
    '黃易': '黄易是著名玄幻武侠小说作家，开创了穿越小说的先河。',
    '錢穆': '钱穆是国学大师，史学家，在中国古代文化研究方面成就卓著。',
    
    // 传统经典作家
    '金庸': '金庸是著名武侠小说大师，作品以宏大的历史背景和深刻的人物塑造著称。',
    '海明威': '海明威是美国著名作家，诺贝尔文学奖得主，以简洁有力的文风闻名。',
    '巴金': '巴金是中国现代文学巨匠，作品深刻反映了时代变迁和人性光辉。',
    '夏目漱石': '夏目漱石是日本近代文学的代表作家，作品融合东西方文化特色。',
    '老舍': '老舍是著名的京味作家，作品充满浓郁的北京地方色彩和幽默风格。',
    '茅盾': '茅盾是中国现代著名作家，现实主义文学的重要代表人物。',
    '余华': '余华是中国当代著名作家，作品关注现实生活，文风深刻犀利。',
    '魯迅': '鲁迅是中国现代文学的奠基人，思想家，以犀利的批判精神著称。'
  };
  
  const description = authorDescriptions[authorName] || `${authorName}是文学界的重要作家。`;
  summary += description;
  
  return {
    summary,
    processingPath,
    authorInfo: {
      name: authorName,
      bookCount,
      subjects,
      description
    }
  };
}

/**
 * 生成动态作者推荐信息 (V3.3.3)
 */
function generateDynamicAuthorRecommendation(authorName, books, matchInfo, dynamicAuthorInfo) {
  const bookCount = books.length;
  const actualBookCount = matchInfo.bookCount || bookCount;
  const subjects = dynamicAuthorInfo?.subjects || [...new Set(books.map(book => book.subject).filter(Boolean))];
  const representativeBooks = dynamicAuthorInfo?.representativeBooks || books.slice(0, 3).map(book => book.title);
  const tier = dynamicAuthorInfo?.tier || 'unknown';
  
  let summary = '';
  let processingPath = '';
  
  // 根据匹配类型生成不同的推荐理由
  if (matchInfo.matchType === 'exact') {
    summary = `为您找到${authorName}的${actualBookCount}本作品，主要包括${subjects.slice(0, 3).join('、')}等类型。`;
    processingPath = 'dynamic_exact_match -> database_query -> success';
  } else if (matchInfo.matchType === 'fuzzy') {
    const similarity = matchInfo.similarity ? `(相似度${(matchInfo.similarity * 100).toFixed(0)}%)` : '';
    summary = `为您找到${authorName}的${actualBookCount}本作品${similarity}，主要包括${subjects.slice(0, 3).join('、')}等类型。`;
    processingPath = 'dynamic_fuzzy_match -> database_query -> success';
  } else if (matchInfo.matchType === 'fulltext') {
    const similarity = matchInfo.similarity ? `(相似度${(matchInfo.similarity * 100).toFixed(0)}%)` : '';
    summary = `通过全文搜索为您找到${authorName}的${actualBookCount}本作品${similarity}，主要包括${subjects.slice(0, 3).join('、')}等类型。`;
    processingPath = 'dynamic_fulltext_search -> database_query -> success';
  } else {
    summary = `为您找到${authorName}的${actualBookCount}本作品，主要包括${subjects.slice(0, 3).join('、')}等类型。`;
    processingPath = 'dynamic_unknown_match -> database_query -> success';
  }
  
  // 生成智能作者描述
  let authorDescription = generateDynamicAuthorDescription(authorName, actualBookCount, tier, subjects, matchInfo);
  summary += authorDescription;
  
  return {
    summary,
    processingPath,
    authorInfo: {
      name: authorName,
      bookCount: actualBookCount,
      subjects: subjects.slice(0, 5),
      representativeBooks: representativeBooks.slice(0, 3),
      tier,
      matchType: matchInfo.matchType,
      similarity: matchInfo.similarity,
      description: authorDescription
    }
  };
}

/**
 * 生成动态作者描述
 */
function generateDynamicAuthorDescription(authorName, bookCount, tier, subjects, matchInfo) {
  // 基于数据的智能描述生成
  let description = '';
  
  // 基础描述
  if (tier === 'ultra_high') {
    description = `${authorName}是图书馆收藏最丰富的超高产作家，馆藏${bookCount}本著作`;
  } else if (tier === 'high') {
    description = `${authorName}是高产作家，馆藏${bookCount}本作品`;
  } else if (tier === 'medium') {
    description = `${authorName}是知名作家，馆藏${bookCount}本作品`;
  } else if (tier === 'low') {
    description = `${authorName}是新兴作家，馆藏${bookCount}本作品`;
  } else {
    description = `${authorName}是作家，馆藏${bookCount}本作品`;
  }
  
  // 学科描述
  if (subjects.length > 0) {
    if (subjects.length === 1) {
      description += `，专注于${subjects[0]}领域`;
    } else if (subjects.length >= 5) {
      description += `，涉及${subjects.slice(0, 3).join('、')}等多个领域，创作领域广泛`;
    } else {
      description += `，主要涉及${subjects.slice(0, 3).join('、')}等领域`;
    }
  }
  
  // 特殊标注
  if (matchInfo.matchType === 'fuzzy' || matchInfo.matchType === 'fulltext') {
    description += '。通过智能匹配为您找到此作者的作品';
  }
  
  // 检查是否是知名作者，添加特殊描述
  const knownAuthorDescriptions = {
    // 保留一些重要作家的特殊描述
    '紀江紅': '，是我们图书馆收藏最丰富的作家，作品涵盖多个学科领域',
    '衛斯理': '，是著名科幻小说作家，以独特的想象力和科幻构思著称',
    '金庸': '，是著名武侠小说大师，作品以宏大的历史背景和深刻的人物塑造著称',
    '古龍': '，是武侠小说三大宗师之一，以独特的武侠风格和人物塑造闻名文坛',
    '莫言': '，是诺贝尔文学奖获得者，中国当代著名作家，作品具有魔幻现实主义色彩'
  };
  
  const specialDescription = knownAuthorDescriptions[authorName];
  if (specialDescription) {
    description += specialDescription;
  }
  
  description += '。';
  return description;
}

/**
 * 简化的关键词提取（增强版 - 支持作者查询）
 */
async function extractSimpleKeywords(query) {
  const text = query.toLowerCase();
  
  // 🎯 优先检测作者查询 (异步) + 错误处理
  try {
    const authorDetection = await detectAuthorQuery(query);
    if (authorDetection) {
      console.log(`👤 [Keyword] 检测到作者查询: ${authorDetection.author}`);
      return {
        type: 'author',
        author: authorDetection.author,
        keywords: [authorDetection.author],
        matchInfo: authorDetection,
        bookCount: authorDetection.bookCount,
        authorInfo: authorDetection.authorInfo
      };
    }
  } catch (error) {
    console.error(`❌ [Keyword] 作者检测异常:`, error);
    // 作者检测失败，继续常规关键词提取
  }
  
  // 直接映射常见查询
  const directMappings = {
    '小说': ['小說', '中國小說', '外國小說'],
    '小說': ['小說', '中國小說', '外國小說'],
    '数学': ['數學', '數學教學', '算術'],
    '數學': ['數學', '數學教學', '算術'],
    '儿童': ['兒童文學', '兒童小說', '童書'],
    '兒童': ['兒童文學', '兒童小說', '童書'],
    '文学': ['文學', '中國文學', '外國文學'],
    '文學': ['文學', '中國文學', '外國文學'],
    '电脑': ['電腦', '計算機', '計算機科學'],
    '電腦': ['電腦', '計算機', '計算機科學'],
    '计算机': ['計算機', '電腦', '計算機科學'],
    '計算機': ['計算機', '電腦', '計算機科學'],
    '历史': ['歷史', '中國歷史', '世界歷史'],
    '歷史': ['歷史', '中國歷史', '世界歷史'],
    '教育': ['教育', '教學', '教育學'],
    '科学': ['科學', '自然科學', '科學教育'],
    '科學': ['科學', '自然科學', '科學教育']
  };
  
  // 检查直接映射
  for (const [key, keywords] of Object.entries(directMappings)) {
    if (text.includes(key.toLowerCase())) {
      return {
        type: 'category',
        keywords: keywords
      };
    }
  }
  
  // 概念映射
  const conceptMappings = {
    '人工智能': ['計算機', '數學', '計算機科學'],
    'ai': ['計算機', '數學', '計算機科學'],
    '机器学习': ['計算機', '數學', '統計學'],
    '编程': ['計算機', '電腦', '程序設計'],
    '程序设计': ['計算機', '電腦', '程序設計'],
    '网站': ['計算機', '電腦', '程序設計'],
    '创业': ['企業管理', '商業', '經濟'],
    '投资': ['經濟學', '金融', '商業'],
    '理财': ['經濟學', '金融', '商業']
  };
  
  for (const [concept, keywords] of Object.entries(conceptMappings)) {
    if (text.includes(concept)) {
      return {
        type: 'concept',
        keywords: keywords
      };
    }
  }
  
  // 默认返回原查询
  return {
    type: 'general',
    keywords: [query]
  };
}

/**
 * 简化的候选图书搜索（增强版 - 支持作者查询）
 */
async function searchCandidateBooksSimple(keywordInfo, limit = 20) {
  // 兼容旧版本调用方式
  let keywords = [];
  if (Array.isArray(keywordInfo)) {
    keywords = keywordInfo;
  } else if (keywordInfo && keywordInfo.keywords) {
    keywords = keywordInfo.keywords;
  } else {
    keywords = [keywordInfo];
  }
  if (!dbPool) {
    console.error('[V3.1] 数据库连接不可用');
    return [];
  }
  
  try {
    const results = [];
    
    for (const keyword of keywords) {
      // 精确匹配
      let sql = `
        SELECT id, title, author, publisher, subject, language, popularity, view_count
        FROM books 
        WHERE subject = $1 
        ORDER BY popularity DESC, view_count DESC 
        LIMIT $2
      `;
      
      let result = await dbPool.query(sql, [keyword, Math.ceil(limit / keywords.length)]);
      
      if (result.rows.length > 0) {
        results.push(...result.rows);
        console.log(`🎯 [V3.1] 精确匹配 "${keyword}": ${result.rows.length}本书`);
        continue;
      }
      
      // 模糊匹配
      sql = `
        SELECT id, title, author, publisher, subject, language, popularity, view_count
        FROM books 
        WHERE subject ILIKE $1 OR title ILIKE $1
        ORDER BY popularity DESC, view_count DESC 
        LIMIT $2
      `;
      
      result = await dbPool.query(sql, [`%${keyword}%`, Math.ceil(limit / keywords.length)]);
      
      if (result.rows.length > 0) {
        results.push(...result.rows);
        console.log(`🔍 [V3.1] 模糊匹配 "${keyword}": ${result.rows.length}本书`);
      }
    }
    
    // 去重并限制数量
    const uniqueBooks = [];
    const seenIds = new Set();
    
    for (const book of results) {
      if (!seenIds.has(book.id)) {
        seenIds.add(book.id);
        uniqueBooks.push(book);
        
        if (uniqueBooks.length >= limit) break;
      }
    }
    
    console.log(`📚 [V3.1] 候选搜索完成: ${uniqueBooks.length}本书 (去重后)`);
    return uniqueBooks;
    
  } catch (error) {
    console.error('[V3.1] 搜索候选图书错误:', error);
    return [];
  }
}

/**
 * 简化的AI推荐
 */
async function getSimpleAIRecommendations(userQuery, candidateBooks, limit = 10) {
  if (!DEEPSEEK_API_KEY || candidateBooks.length === 0) {
    return null;
  }
  
  try {
    const bookList = candidateBooks.slice(0, 15).map((book, index) => 
      `${index + 1}. ID:${book.id} - 《${book.title}》作者:${book.author} 分类:${book.subject}`
    ).join('\n');
    
    const prompt = `用户查询："${userQuery}"

请从以下图书中选择最相关的${limit}本推荐给用户：

${bookList}

请返回JSON格式，包含：
1. summary: 推荐总结
2. recommendations: 推荐列表，每本书包含id, title, author, subject, reason

要求：
- 选择与用户查询最相关的图书
- reason要说明推荐理由
- 返回有效的JSON格式`;

    const response = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data?.choices?.[0]?.message?.content) {
      const content = response.data.choices[0].message.content.trim();
      
      // 尝试解析JSON
      let jsonStart = content.indexOf('{');
      let jsonEnd = content.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonStr = content.substring(jsonStart, jsonEnd + 1);
        const aiResult = JSON.parse(jsonStr);
        
        if (aiResult.recommendations && Array.isArray(aiResult.recommendations)) {
          // 验证推荐的书籍ID是否在候选列表中
          const candidateIds = new Set(candidateBooks.map(b => b.id));
          const validRecommendations = aiResult.recommendations.filter(rec => 
            candidateIds.has(rec.id)
          );
          
          if (validRecommendations.length > 0) {
            console.log(`🤖 [V3.1] AI推荐成功: ${validRecommendations.length}本书`);
            return {
              summary: aiResult.summary || `为您推荐以下相关图书`,
              recommendations: validRecommendations
            };
          }
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[V3.1] AI推荐调用失败:', error.message);
    return null;
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
