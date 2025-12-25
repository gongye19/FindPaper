"""
API Schema定义：使用Pydantic规范化输入输出
"""
from typing import List, Optional
from pydantic import BaseModel, Field


# ==============================
# 查询改写服务 Schema
# ==============================

class QueryRewriteRequest(BaseModel):
    """查询改写请求"""
    query: str = Field(..., description="用户原始查询", example="我想找关于因果推理的论文")


class QueryRewriteResponse(BaseModel):
    """查询改写响应"""
    original_query: str = Field(..., description="原始查询")
    keywords: str = Field(..., description="提取的英文关键词列表（逗号分隔）", example="causal inference, causality, causal reasoning")
    success: bool = Field(..., description="是否成功")


# ==============================
# 检索服务 Schema
# ==============================

class SearchRequest(BaseModel):
    """检索请求"""
    query: str = Field(..., description="搜索关键词（建议使用改写后的查询）")
    venues: Optional[List[str]] = Field(default=None, description="选定的venues列表，None表示搜索所有")
    start_year: int = Field(default=2024, description="起始年份", ge=1900, le=2100)
    end_year: int = Field(default=2025, description="结束年份", ge=1900, le=2100)
    rows_each: int = Field(default=3, description="每个venue返回的论文数量", ge=1, le=100)
    search_journal: bool = Field(default=True, description="是否搜索期刊")
    search_conference: bool = Field(default=True, description="是否搜索会议")


class PaperAuthor(BaseModel):
    """论文作者"""
    name: str = Field(..., description="作者姓名")


class Paper(BaseModel):
    """论文信息"""
    venue_code: str = Field(..., description="Venue代码")
    venue_type: str = Field(..., description="Venue类型（JOURNAL/CONFERENCE）")
    title: str = Field(..., description="论文标题")
    year: Optional[int] = Field(None, description="发表年份")
    journal_or_proceedings: str = Field(..., description="期刊或会议名称")
    doi: Optional[str] = Field(None, description="DOI")
    url: Optional[str] = Field(None, description="论文链接")
    authors: List[str] = Field(default_factory=list, description="作者列表")
    abstract: Optional[str] = Field(None, description="摘要")
    abstract_source: Optional[str] = Field(None, description="摘要来源（crossref/semanticscholar-batch/semanticscholar-single/semanticscholar-title）")


class SearchResponse(BaseModel):
    """检索响应"""
    query: str = Field(..., description="使用的搜索关键词")
    total_papers: int = Field(..., description="找到的论文总数")
    papers: List[Paper] = Field(..., description="论文列表")
    success: bool = Field(..., description="是否成功")
    message: Optional[str] = Field(None, description="消息")


# ==============================
# 文档过滤服务 Schema
# ==============================

class FilterRequest(BaseModel):
    """文档过滤请求"""
    user_query: str = Field(..., description="用户原始查询（用于判断相关性）")
    papers: List[Paper] = Field(..., description="待过滤的论文列表")


class FilterResponse(BaseModel):
    """文档过滤响应"""
    original_count: int = Field(..., description="过滤前的论文数量")
    filtered_count: int = Field(..., description="过滤后的论文数量")
    papers: List[Paper] = Field(..., description="过滤后的论文列表")
    success: bool = Field(..., description="是否成功")
    message: Optional[str] = Field(None, description="消息")


# ==============================
# 完整搜索流程 Schema
# ==============================

class PaperSearchRequest(BaseModel):
    """完整论文搜索请求（包含改写、检索、过滤）"""
    query: str = Field(..., description="用户原始查询", example="我想找关于因果推理的论文")
    venues: Optional[List[str]] = Field(default=None, description="选定的venues列表，None表示搜索所有")
    start_year: int = Field(default=2024, description="起始年份", ge=1900, le=2100)
    end_year: int = Field(default=2025, description="结束年份", ge=1900, le=2100)
    rows_each: int = Field(default=3, description="每个venue返回的论文数量", ge=1, le=100)
    search_journal: bool = Field(default=True, description="是否搜索期刊")
    search_conference: bool = Field(default=True, description="是否搜索会议")


class PaperSearchResponse(BaseModel):
    """完整论文搜索响应"""
    original_query: str = Field(..., description="用户原始查询")
    keywords: str = Field(..., description="提取的英文关键词列表（逗号分隔）")
    total_papers_before_filter: int = Field(..., description="过滤前的论文总数")
    total_papers_after_filter: int = Field(..., description="过滤后的论文总数")
    papers_before_filter: List[Paper] = Field(..., description="过滤前的论文列表")
    papers: List[Paper] = Field(..., description="过滤后的论文列表")
    success: bool = Field(..., description="是否成功")
    message: Optional[str] = Field(None, description="消息")


# ==============================
# 通用错误响应 Schema
# ==============================

class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误信息")
    details: Optional[str] = Field(None, description="错误详情")


# ==============================
# 用户检查服务 Schema
# ==============================

class CheckUserRequest(BaseModel):
    """检查用户是否存在请求"""
    email: str = Field(..., description="用户邮箱", example="user@example.com")


class CheckUserResponse(BaseModel):
    """检查用户是否存在响应"""
    email: str = Field(..., description="查询的邮箱")
    exists: bool = Field(..., description="用户是否存在")
    success: bool = Field(..., description="是否成功")
