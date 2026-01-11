"""
FastAPI服务：提供论文搜索的RESTful API
"""
import os
import logging
import asyncio
from pathlib import Path
from typing import List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import json

from schema import (
    QueryRewriteRequest, QueryRewriteResponse,
    SearchRequest, SearchResponse, Paper,
    FilterRequest, FilterResponse,
    PaperSearchRequest, PaperSearchResponse,
    ErrorResponse,
    CheckUserRequest, CheckUserResponse,
    EnsureProfileRequest, EnsureProfileResponse
)
from services.llm_service import LLMService
from services.query_rewrite import QueryRewriteService
from services.crossref_service import CrossRefService
from services.semantic_scholar_service import SemanticScholarService
from services.paper_filtering import PaperFilteringService
from services.supabase_service import get_supabase_service
from middleware.quota_guard import get_quota_guard

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# 禁用httpx和urllib3的HTTP请求日志（这些日志太冗余）
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

# 加载环境变量
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"已加载环境变量文件: {env_path}")
else:
    logger.warning(f"环境变量文件不存在: {env_path}")

# 初始化FastAPI应用
app = FastAPI(
    title="Paper Search API",
    description="学术论文搜索API服务",
    version="1.0.0"
)

# 配置CORS - 支持开发和生产环境
# 从环境变量读取允许的域名
# 开发环境：不设置或设置为 "*" 时允许所有
# 生产环境：设置为具体域名，如 "https://your-app.vercel.app"
ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS", "").strip()

# 调试：记录原始环境变量值
logger.info(f"CORS: 原始环境变量值: '{ALLOWED_ORIGINS_ENV}'")

# 如果环境变量值包含了 "ALLOWED_ORIGINS=" 前缀，去掉它
if ALLOWED_ORIGINS_ENV.startswith("ALLOWED_ORIGINS="):
    ALLOWED_ORIGINS_ENV = ALLOWED_ORIGINS_ENV.replace("ALLOWED_ORIGINS=", "", 1).strip()
    logger.info(f"CORS: 清理后的环境变量值: '{ALLOWED_ORIGINS_ENV}'")

if not ALLOWED_ORIGINS_ENV or ALLOWED_ORIGINS_ENV == "*":
    # 开发环境或未配置：允许所有（向后兼容）
    allow_origins = ["*"]
    logger.info("CORS: 允许所有来源（开发模式）")
else:
    # 生产环境：使用配置的域名列表
    allow_origins = [origin.strip() for origin in ALLOWED_ORIGINS_ENV.split(",") if origin.strip()]
    logger.info(f"CORS: 允许的来源: {allow_origins}")
    
    # 如果配置了 Vercel 主域名，自动添加所有 Vercel 预览域名
    # 例如：配置了 https://find-paper.vercel.app，自动允许所有 https://find-paper-*.vercel.app
    vercel_origins = []
    for origin in allow_origins:
        if origin.startswith("https://") and origin.endswith(".vercel.app"):
            # 提取主域名部分（例如：find-paper）
            main_domain = origin.replace("https://", "").replace(".vercel.app", "")
            # 添加 Vercel 预览域名模式（使用正则表达式）
            # 注意：FastAPI 的 CORSMiddleware 不支持通配符，所以我们需要使用 allow_origin_regex
            vercel_origins.append(f"https://{main_domain}-.*\\.vercel\\.app")
    
    # 合并所有域名
    if vercel_origins:
        logger.info(f"CORS: 自动添加 Vercel 预览域名模式: {vercel_origins}")

# 使用自定义的 CORS 中间件来支持 Vercel 预览域名
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

def is_origin_allowed(origin: str, allowed_origins: List[str]) -> bool:
    """检查 origin 是否被允许（支持 Vercel 预览域名）"""
    if "*" in allowed_origins:
        return True
    
    # 精确匹配
    if origin in allowed_origins:
        return True
    
    # 支持 Vercel 预览域名：如果配置了主域名，自动允许所有预览域名
    # 例如：配置了 https://find-paper.vercel.app，自动允许 https://find-paper-*.vercel.app
    for allowed in allowed_origins:
        if allowed.startswith("https://") and allowed.endswith(".vercel.app"):
            # 提取主域名部分（例如：find-paper）
            main_domain = allowed.replace("https://", "").replace(".vercel.app", "")
            # 检查是否是 Vercel 预览域名（格式：https://{main_domain}-{hash}.vercel.app）
            if origin.startswith(f"https://{main_domain}-") and origin.endswith(".vercel.app"):
                return True
    
    return False

class CustomCORSMiddleware(BaseHTTPMiddleware):
    """自定义 CORS 中间件，支持 Vercel 预览域名"""
    
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        
        # 检查是否允许该 origin
        is_allowed = is_origin_allowed(origin, allow_origins) if origin else False
        
        # 处理 OPTIONS 预检请求
        if request.method == "OPTIONS":
            response = Response()
            if is_allowed and origin:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
                response.headers["Access-Control-Allow-Headers"] = "*"
                response.headers["Access-Control-Allow-Credentials"] = "true"
                response.headers["Access-Control-Max-Age"] = "86400"
            return response
        
        # 处理正常请求
        response = await call_next(request)
        if is_allowed and origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            response.headers["Access-Control-Allow-Credentials"] = "true"
        
        return response

app.add_middleware(CustomCORSMiddleware)

# 从config导入venue配置
from config import (
    JOURNAL_VENUES, CONFERENCE_VENUES, CONFERENCE_NAME_FILTERS,
    MAX_CROSSREF_WORKERS, MAX_FILTERING_WORKERS
)
from concurrent.futures import ThreadPoolExecutor, as_completed

# 初始化服务（单例模式）
llm_service = LLMService()
query_rewrite_service = QueryRewriteService(llm_service)
crossref_service = CrossRefService()
s2_service = SemanticScholarService()
paper_filtering_service = PaperFilteringService(llm_service, max_workers=MAX_FILTERING_WORKERS)


# ==============================
# 辅助函数
# ==============================

def prepare_venues(venues: List[str] = None, search_journal: bool = True, search_conference: bool = True) -> List[tuple]:
    """
    准备要搜索的venue列表
    :param venues: 选定的venue代码列表，None表示搜索所有
    :param search_journal: 是否搜索期刊
    :param search_conference: 是否搜索会议
    :return: [(code, name, type), ...] 列表
    """
    venue_list = []
    if search_journal:
        for code, name in JOURNAL_VENUES.items():
            if venues is None or code in venues:
                venue_list.append((code, name, "JOURNAL"))
    if search_conference:
        for code, name in CONFERENCE_VENUES.items():
            if venues is None or code in venues:
                venue_list.append((code, name, "CONFERENCE"))
    return venue_list


def search_crossref_parallel(
    keyword: str,
    venues: List[tuple],
    from_year: int,
    to_year: int,
    rows_each: int
) -> List[dict]:
    """
    并行搜索所有venues
    :return: 扁平化的论文列表
    """
    job_args = []
    venue_info_map = {}
    for idx, (code, name, vtype) in enumerate(venues):
        job_args.append((keyword, code, name, vtype, from_year, to_year, rows_each))
        venue_info_map[idx] = (code, name, vtype)
    
    all_results_per_venue = [None] * len(venues)
    max_workers = min(MAX_CROSSREF_WORKERS, len(job_args)) or 1
    
    def search_wrapper(args):
        keyword, code, name, vtype, from_year, to_year, rows = args
        try:
            results = crossref_service.search_one_venue(
                keyword=keyword,
                venue_code=code,
                venue_name=name,
                venue_type=vtype,
                from_year=from_year,
                to_year=to_year,
                rows=rows,
                conference_filters=CONFERENCE_NAME_FILTERS if vtype == "CONFERENCE" else None
            )
            return results, None
        except Exception as e:
            logger.error(f"搜索 {code} 时出错: {e}")
            return [], str(e)
    
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        future_to_index = {
            ex.submit(search_wrapper, job_args[idx]): idx 
            for idx in range(len(job_args))
        }
        
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                results, err = future.result()
                all_results_per_venue[idx] = results
                if err:
                    logger.error(f"Venue {venue_info_map[idx][0]} 搜索出错: {err}")
            except Exception as e:
                all_results_per_venue[idx] = []
                logger.error(f"Venue {venue_info_map[idx][0]} 执行异常: {e}")
    
    # 扁平化结果
    all_papers = []
    for venue_results in all_results_per_venue:
        if venue_results:
            all_papers.extend(venue_results)
    
    return all_papers


def supplement_abstracts(papers: List[dict], progress_callback=None) -> List[dict]:
    """
    补充论文摘要（优化版本：优先使用批量API，单条兜底）
    :param papers: 论文列表
    :return: 补充摘要后的论文列表
    """
    # 收集所有需要补充摘要的论文
    papers_need_abstract = [
        (p.get("doi"), p["title"], p.get("year"), p)
        for p in papers
        if not p.get("abstract")
    ]
    
    if not papers_need_abstract:
        return papers
    
    total_count = len(papers_need_abstract)
    logger.info(f"共 {total_count} 篇论文需要补充摘要")
    
    # 步骤1: 优先使用批量API获取有DOI的论文摘要
    papers_with_doi = [(doi, p) for doi, title, year, p in papers_need_abstract if doi]
    if papers_with_doi:
        logger.info(f"批量获取 {len(papers_with_doi)} 篇有DOI的论文摘要...")
        dois_batch = [doi for doi, p in papers_with_doi]
        s2_batch_map = s2_service.fetch_abstract_batch(dois_batch)
        
        batch_updated = 0
        for doi, p in papers_with_doi:
            if p.get("abstract"):  # 防止重复
                continue
            abs_text = s2_batch_map.get(doi.lower())
            if abs_text:
                p["abstract"] = abs_text
                p["abstract_source"] = "semanticscholar-batch"
                batch_updated += 1
        logger.info(f"批量获取完成: {batch_updated}/{len(papers_with_doi)} 篇成功")
    
    # 步骤2: 对于没有DOI或批量未获取到的论文，使用单条API兜底
    papers_need_single = [
        (doi, title, year, p)
        for doi, title, year, p in papers_need_abstract
        if not p.get("abstract")
    ]
    
    if papers_need_single:
        logger.info(f"单条获取 {len(papers_need_single)} 篇论文的摘要（无DOI或批量未获取到）...")
        single_updated = 0
        single_total = len(papers_need_single)
        
        for idx, (doi, title, year, paper) in enumerate(papers_need_single, 1):
            if paper.get("abstract"):  # 防止重复
                continue
            try:
                abs_text = s2_service.fetch_abstract_single(doi=doi, title=title, year=year)
                if abs_text:
                    paper["abstract"] = abs_text
                    if doi:
                        paper["abstract_source"] = "semanticscholar-single"
                    else:
                        paper["abstract_source"] = "semanticscholar-title"
                    single_updated += 1
                logger.info(f"[{idx}/{single_total}] {title[:50]}...: {'成功' if abs_text else '未找到'}")
                
                # 推送进度更新（每处理1篇就推送，确保实时性）
                if progress_callback:
                    progress_callback({
                        "step": "abstract",
                        "message": f"补充摘要... ({idx}/{single_total})",
                        "status": "running"
                    })
            except Exception as e:
                logger.warning(f"[{idx}/{single_total}] 单条获取摘要失败 ({title[:30]}...): {e}")
                # 继续处理下一篇，不中断流程
                # 即使失败也推送进度
                if progress_callback:
                    progress_callback({
                        "step": "abstract",
                        "message": f"补充摘要... ({idx}/{single_total})",
                        "status": "running"
                    })
        
        logger.info(f"单条补充完成: {single_updated}/{single_total} 篇成功")
    
    # 统计总结
    final_with_abstract = sum(1 for p in papers if p.get("abstract"))
    logger.info(f"摘要补充完成: 共 {final_with_abstract}/{total_count} 篇论文有摘要")
    return papers


# ==============================
# API Endpoints
# ==============================

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Paper Search API",
        "version": "1.0.0",
        "endpoints": {
            "v1/paper_search": "POST - 完整论文搜索流程（改写+检索+过滤）",
            "v1/query_rewrite": "POST - 查询改写服务",
            "v1/paper_retrieval": "POST - 论文检索服务",
            "v1/paper_filtering": "POST - 论文过滤服务",
            "v1/quota": "GET - 获取用户配额信息",
            "v1/check_user": "POST - 检查用户是否存在",
            "v1/ensure_profile": "POST - 确保用户 profile 存在"
        }
    }


@app.get("/v1/quota")
async def get_quota(http_request: Request):
    """
    获取用户配额信息（不扣减配额）
    """
    quota_guard = get_quota_guard()
    quota_info = quota_guard.get_quota_info(http_request)
    
    if quota_info is None:
        # 如果没有身份信息，返回默认值
        return {
            "user_type": "anon",
            "remaining": 3,
            "limit": 3,
            "used_count": 0,
            "plan": None
        }
    
    return quota_info


@app.post("/v1/check_user", response_model=CheckUserResponse)
async def check_user(request: CheckUserRequest):
    """
    检查用户是否存在（通过邮箱）
    """
    try:
        supabase_service = get_supabase_service()
        exists = supabase_service.check_user_exists(request.email)
        
        return CheckUserResponse(
            email=request.email,
            exists=exists,
            success=True
        )
    except Exception as e:
        logger.error(f"检查用户是否存在出错: {e}")
        raise HTTPException(status_code=500, detail=f"检查用户失败: {str(e)}")


@app.post("/v1/ensure_profile", response_model=EnsureProfileResponse)
async def ensure_profile(request: EnsureProfileRequest, http_request: Request):
    """
    确保用户的 profile 存在，如果不存在则创建
    需要用户认证（通过 Authorization header 或 X-Anon-Id）
    """
    try:
        # 验证用户身份
        user_id = None
        
        # 1. 尝试从 Authorization header 获取登录用户
        auth_header = http_request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            supabase_service = get_supabase_service()
            if supabase_service.is_available():
                user_info = supabase_service.verify_jwt_token(token)
                if user_info and user_info.get("user_id"):
                    user_id = user_info["user_id"]
                    # 验证请求的 user_id 是否与 token 中的一致
                    if user_id != request.user_id:
                        logger.warning(f"用户 ID 不匹配: token={user_id}, request={request.user_id}")
                        raise HTTPException(status_code=403, detail="用户 ID 不匹配")
        
        # 如果没有从 token 获取到，使用请求中的 user_id（可能是匿名用户或特殊情况）
        if not user_id:
            user_id = request.user_id
        
        if not user_id:
            raise HTTPException(status_code=401, detail="需要用户认证")
        
        # 确保 profile 存在
        supabase_service = get_supabase_service()
        result = supabase_service.ensure_user_profile(user_id)
        
        return EnsureProfileResponse(
            user_id=user_id,
            created=result.get("created", False),
            success=result.get("success", False),
            message=result.get("message")
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"确保 profile 存在出错: {e}")
        raise HTTPException(status_code=500, detail=f"确保 profile 失败: {str(e)}")


@app.post("/v1/query_rewrite", response_model=QueryRewriteResponse)
async def query_rewrite(request: QueryRewriteRequest):
    """
    查询改写服务：提取用户查询中的英文关键词列表
    """
    try:
        keywords = query_rewrite_service.rewrite_query(request.query)
        return QueryRewriteResponse(
            original_query=request.query,
            keywords=keywords,
            success=True
        )
    except Exception as e:
        logger.error(f"查询改写出错: {e}")
        raise HTTPException(status_code=500, detail=f"查询改写失败: {str(e)}")


@app.post("/v1/paper_retrieval", response_model=SearchResponse)
async def paper_retrieval(request: SearchRequest):
    """
    论文检索服务：从多个venue中搜索论文
    """
    try:
        logger.info(f"开始搜索: query={request.query}, venues={request.venues}, year=[{request.start_year}, {request.end_year}]")
        
        # 准备venue列表
        venues = prepare_venues(
            venues=request.venues,
            search_journal=request.search_journal,
            search_conference=request.search_conference
        )
        
        if not venues:
            return SearchResponse(
                query=request.query,
                total_papers=0,
                papers=[],
                success=True,
                message="没有可搜索的venue"
            )
        
        # 并行搜索
        papers = search_crossref_parallel(
            keyword=request.query,
            venues=venues,
            from_year=request.start_year,
            to_year=request.end_year,
            rows_each=request.rows_each
        )
        
        # 补充摘要
        papers = supplement_abstracts(papers, progress_callback=None)
        
        # 转换为Pydantic模型
        paper_models = [Paper(**p) for p in papers]
        
        return SearchResponse(
            query=request.query,
            total_papers=len(paper_models),
            papers=paper_models,
            success=True,
            message=f"找到 {len(paper_models)} 篇论文"
        )
        
    except Exception as e:
        logger.error(f"搜索出错: {e}")
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")


@app.post("/v1/paper_filtering", response_model=FilterResponse)
async def paper_filtering(request: FilterRequest):
    """
    论文过滤服务：使用LLM判断论文是否符合用户需求
    """
    try:
        logger.info(f"开始过滤: user_query={request.user_query}, papers_count={len(request.papers)}")
        
        # 转换为字典格式
        papers_dict = [p.dict() for p in request.papers]
        
        # 过滤论文
        filtered_papers_dict = paper_filtering_service.filter_papers(
            user_query=request.user_query,
            papers=papers_dict
        )
        
        # 转换为Pydantic模型
        filtered_papers = [Paper(**p) for p in filtered_papers_dict]
        
        return FilterResponse(
            original_count=len(request.papers),
            filtered_count=len(filtered_papers),
            papers=filtered_papers,
            success=True,
            message=f"过滤完成: {len(filtered_papers)}/{len(request.papers)} 篇论文符合需求"
        )
        
    except Exception as e:
        logger.error(f"过滤出错: {e}")
        raise HTTPException(status_code=500, detail=f"过滤失败: {str(e)}")


def sse_event(event_type: str, data: dict) -> str:
    """生成SSE格式的事件"""
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event_type}\ndata: {payload}\n\n"


@app.post("/v1/paper_search")
async def paper_search(request: PaperSearchRequest, http_request: Request):
    """
    完整论文搜索流程：改写查询 -> 检索论文 -> 过滤论文
    使用SSE实时推送进度
    """
    # 配额检查：在搜索开始前检查配额
    quota_guard = get_quota_guard()
    passed, user_type, remaining = quota_guard.check_quota(http_request)
    
    if not passed:
        # 配额不足，抛出异常
        quota_guard.raise_quota_exceeded(user_type or "anon")
    
    logger.info(f"配额检查通过: user_type={user_type}, remaining={remaining}")
    
    async def event_generator():
        try:
            logger.info(f"开始完整搜索流程: query={request.query}, venues={request.venues}, year=[{request.start_year}, {request.end_year}]")
            
            # 步骤1: 查询改写（同时发送配额信息）
            yield sse_event("progress", {
                "step": "query_rewrite",
                "message": "查询改写...",
                "status": "running",
                "quota_remaining": remaining  # 添加配额信息
            })
            logger.info("步骤1: 查询改写...")
            keywords = query_rewrite_service.rewrite_query(request.query)
            logger.info(f"提取的关键词: {request.query} -> {keywords}")
            
            # 步骤1完成，推送完成事件（可选，让前端知道步骤1已完成）
            yield sse_event("progress", {
                "step": "query_rewrite",
                "message": "查询改写完成",
                "status": "running"
            })
            # 添加短暂延迟，确保前端能正确显示进度
            await asyncio.sleep(0.2)
            
            # 步骤2: 准备venue列表（这一步很快，不需要单独推送进度）
            venues = prepare_venues(
                venues=request.venues,
                search_journal=request.search_journal,
                search_conference=request.search_conference
            )
            
            if not venues:
                # 推送完成进度
                yield sse_event("progress", {
                    "step": "completed",
                    "message": "搜索完成",
                    "status": "completed"
                })
                # 发送结果（即使没有venue也要返回结果，让前端显示相应消息）
                yield sse_event("result", {
                    "original_query": request.query,
                    "keywords": keywords,
                    "total_papers_before_filter": 0,
                    "total_papers_after_filter": 0,
                    # 不发送papers_before_filter数组
                    "papers": [],
                    "success": True,
                    "message": "没有可搜索的venue",
                    "quota_remaining": remaining  # 添加配额信息
                })
                return
            
            # 步骤2: 论文检索
            yield sse_event("progress", {
                "step": "search",
                "message": "论文检索...",
                "status": "running"
            })
            logger.info("步骤2: 论文检索...")
            papers = search_crossref_parallel(
                keyword=keywords,
                venues=venues,
                from_year=request.start_year,
                to_year=request.end_year,
                rows_each=request.rows_each
            )
            logger.info(f"检索到 {len(papers)} 篇论文")
            
            # 步骤2完成，推送完成事件
            yield sse_event("progress", {
                "step": "search",
                "message": "论文检索完成",
                "status": "running"
            })
            # 添加短暂延迟，确保前端能正确显示进度
            await asyncio.sleep(0.2)
            
            # 步骤3: 补充摘要
            # 确保前端有时间更新UI，添加短暂延迟
            await asyncio.sleep(0.1)
            yield sse_event("progress", {
                "step": "abstract",
                "message": "补充摘要...",
                "status": "running"
            })
            logger.info("步骤3: 补充摘要...")
            
            # 由于supplement_abstracts是同步函数，我们需要在它执行过程中实时推送进度
            # 使用一个特殊的回调机制：回调函数会直接yield进度事件
            # 但问题是：在同步函数中无法直接yield，所以我们需要另一种方法
            
            # 方案：将supplement_abstracts改为生成器，在每次处理一篇论文时yield进度
            # 但这样改动太大，暂时使用队列方案
            
            # 关键问题：supplement_abstracts是同步函数，执行期间无法实时推送进度
            # 解决方案：使用一个特殊的机制，在supplement_abstracts执行过程中实时推送进度
            # 但由于Python的GIL和同步函数的限制，我们需要使用线程或异步机制
            
            # 方案：使用asyncio在后台运行supplement_abstracts，并在执行过程中推送进度
            from concurrent.futures import ThreadPoolExecutor
            
            # 创建一个共享的进度队列和事件
            progress_queue = asyncio.Queue()
            supplement_done = asyncio.Event()
            
            def progress_callback_wrapper(progress_data):
                """进度回调函数，将进度数据添加到异步队列"""
                # 注意：这个回调在同步函数中被调用，所以我们需要使用线程安全的方式
                try:
                    # 使用call_soon_threadsafe来安全地将数据添加到队列
                    loop = asyncio.get_event_loop()
                    loop.call_soon_threadsafe(progress_queue.put_nowait, progress_data)
                except:
                    # 如果无法获取事件循环，直接添加到普通队列
                    pass
            
            async def run_supplement_abstracts():
                """在后台线程中运行supplement_abstracts"""
                loop = asyncio.get_event_loop()
                with ThreadPoolExecutor() as executor:
                    result = await loop.run_in_executor(
                        executor,
                        supplement_abstracts,
                        papers,
                        progress_callback_wrapper
                    )
                    supplement_done.set()
                    return result
            
            # 启动supplement_abstracts任务
            supplement_task = asyncio.create_task(run_supplement_abstracts())
            
            # 在supplement_abstracts执行期间，实时推送进度更新
            while not supplement_done.is_set():
                try:
                    # 等待进度更新或完成事件
                    progress_data = await asyncio.wait_for(progress_queue.get(), timeout=0.1)
                    yield sse_event("progress", progress_data)
                except asyncio.TimeoutError:
                    # 超时，继续等待
                    await asyncio.sleep(0.1)
                    continue
            
            # 等待supplement_abstracts完成
            papers = await supplement_task
            
            # 推送完成消息
            yield sse_event("progress", {
                "step": "abstract",
                "message": "补充摘要完成",
                "status": "running"
            })
            # 添加短暂延迟，确保前端能正确显示进度
            await asyncio.sleep(0.2)
            
            # 步骤4: 过滤论文
            # 确保前端有时间更新UI，添加短暂延迟
            await asyncio.sleep(0.1)
            yield sse_event("progress", {
                "step": "filter",
                "message": "论文过滤...",
                "status": "running"
            })
            logger.info("步骤4: 论文过滤...")
            papers_dict = papers  # 已经是字典格式
            filtered_papers_dict = paper_filtering_service.filter_papers(
                user_query=request.query,  # 使用原始查询进行过滤
                papers=papers_dict
            )
            logger.info(f"过滤完成: {len(filtered_papers_dict)}/{len(papers)} 篇论文符合需求")
            
            # 步骤4完成，推送完成事件
            yield sse_event("progress", {
                "step": "filter",
                "message": "论文过滤完成",
                "status": "running"
            })
            # 添加短暂延迟，确保前端能正确显示进度
            await asyncio.sleep(0.2)
            
            # 转换为Pydantic模型（添加错误处理）
            papers_before_filter = []
            filtered_papers = []
            try:
                papers_before_filter = [Paper(**p) for p in papers]  # 过滤前的论文列表
                filtered_papers = [Paper(**p) for p in filtered_papers_dict]  # 过滤后的论文列表
            except Exception as e:
                logger.warning(f"转换为Pydantic模型时出错: {e}，使用原始字典格式")
                # 如果转换失败，直接使用字典格式
                papers_before_filter = papers
                filtered_papers = filtered_papers_dict
            
            # 发送完成进度
            yield sse_event("progress", {
                "step": "completed",
                "message": "搜索完成",
                "status": "completed"
            })
            
            # 发送最终结果
            try:
                # 尝试使用model_dump，如果失败则直接使用字典
                papers_before_filter_data = []
                filtered_papers_data = []
                
                for p in papers_before_filter:
                    if hasattr(p, 'model_dump'):
                        papers_before_filter_data.append(p.model_dump())
                    else:
                        papers_before_filter_data.append(p)
                
                for p in filtered_papers:
                    if hasattr(p, 'model_dump'):
                        filtered_papers_data.append(p.model_dump())
                    else:
                        filtered_papers_data.append(p)
                
                # 只发送必要的字段，不发送papers_before_filter数组以减小payload大小
                result_payload = {
                    "original_query": request.query,
                    "keywords": keywords,
                    "total_papers_before_filter": len(papers),
                    "total_papers_after_filter": len(filtered_papers_dict),
                    # 不发送papers_before_filter数组，前端只需要统计数字
                    # "papers_before_filter": papers_before_filter_data,
                    "papers": filtered_papers_data,
                    "success": True,
                    "message": f"搜索完成: 找到 {len(papers)} 篇论文，过滤后剩余 {len(filtered_papers_dict)} 篇",
                    "quota_remaining": remaining  # 添加配额信息
                }
                logger.info(f"发送result事件: total_before={len(papers)}, total_after={len(filtered_papers_dict)}")
                # 记录payload大小，帮助排查问题
                import sys
                payload_size = sys.getsizeof(json.dumps(result_payload, ensure_ascii=False))
                logger.info(f"result事件payload大小: {payload_size} bytes, papers数量: {len(filtered_papers_data)}")
                result_event_str = sse_event("result", result_payload)
                logger.info(f"result事件字符串长度: {len(result_event_str)} bytes")
                # 检查result事件字符串的前100个字符，确认格式正确
                logger.info(f"result事件前100字符: {result_event_str[:100]}")
                yield result_event_str
                logger.info("result事件已发送")
                # 刷新输出缓冲区，确保数据立即发送
                import sys
                sys.stdout.flush()
                # 添加短暂延迟，确保事件完全发送
                await asyncio.sleep(0.2)
            except Exception as e:
                logger.error(f"构建result_payload时出错: {e}")
                # 即使出错也要发送result事件，使用最简单的格式
                # 简化格式：不发送papers_before_filter数组
                result_payload = {
                    "original_query": request.query,
                    "keywords": keywords,
                    "total_papers_before_filter": len(papers),
                    "total_papers_after_filter": len(filtered_papers_dict),
                    # 不发送papers_before_filter数组，前端只需要统计数字
                    # "papers_before_filter": papers,
                    "papers": filtered_papers_dict,
                    "success": True,
                    "message": f"搜索完成: 找到 {len(papers)} 篇论文，过滤后剩余 {len(filtered_papers_dict)} 篇",
                    "quota_remaining": remaining  # 添加配额信息
                }
                logger.info(f"发送result事件（简化格式）: total_before={len(papers)}, total_after={len(filtered_papers_dict)}")
                yield sse_event("result", result_payload)
            
        except Exception as e:
            logger.error(f"完整搜索流程出错: {e}", exc_info=True)
            import traceback
            logger.error(f"错误堆栈: {traceback.format_exc()}")
            try:
                yield sse_event("error", {
                    "error": str(e),
                    "message": f"搜索失败: {str(e)}"
                })
            except Exception as e2:
                logger.error(f"发送error事件时也出错: {e2}")
    
    # 在响应 header 中添加剩余配额信息（如果检查通过）
    response_headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # 禁用Nginx缓冲
    }
    if passed and remaining is not None:
        response_headers["X-Quota-Remaining"] = str(remaining)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers=response_headers
    )


if __name__ == "__main__":
    import uvicorn
    import os
    # Railway 使用 PORT 环境变量，本地开发默认 8000
    port = int(os.getenv("PORT", 8000))
    logger.info(f"启动服务器: host=0.0.0.0, port={port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
