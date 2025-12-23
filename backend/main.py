"""
论文搜索主程序
"""
import os
import sys
import re
import json
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

from services.llm_service import LLMService
from services.crossref_service import CrossRefService
from services.semantic_scholar_service import SemanticScholarService
from services.query_rewrite import QueryRewriteService
from services.paper_filtering import PaperFilteringService

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ==============================
# 配置加载
# ==============================

# 加载环境变量（优先.env，其次.env.dev）
env_path = Path(__file__).parent / ".env"
if not env_path.exists():
    env_path = Path(__file__).parent / ".env.dev"
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"已加载环境变量文件: {env_path}")
else:
    logger.warning(f"环境变量文件不存在: {env_path}")

# 命令行参数
KEYWORD = sys.argv[1] if len(sys.argv) > 1 else "causal inference"
FROM_YEAR = int(sys.argv[2]) if len(sys.argv) > 2 else 2024
TO_YEAR = int(sys.argv[3]) if len(sys.argv) > 3 else 2025
SELECTED_VENUES = sys.argv[4] if len(sys.argv) > 4 else "all"
ROWS_EACH = int(os.getenv("ROWS_EACH", "3"))

SEARCH_JOURNAL = os.getenv("SEARCH_JOURNAL", "True").lower() == "true"
SEARCH_CONFERENCE = os.getenv("SEARCH_CONFERENCE", "True").lower() == "true"

if SELECTED_VENUES != "all":
    selected_venue_list = SELECTED_VENUES.split(',')
else:
    selected_venue_list = None

# 从config导入venue配置
from config import (
    JOURNAL_VENUES, CONFERENCE_VENUES, CONFERENCE_NAME_FILTERS,
    MAX_CROSSREF_WORKERS, MAX_FILTERING_WORKERS
)


# ==============================
# 步骤1: 查询改写
# ==============================

def rewrite_query(user_query: str, query_rewrite_service: QueryRewriteService) -> str:
    """
    使用查询改写服务提取英文关键词列表
    :param user_query: 用户原始查询
    :param query_rewrite_service: 查询改写服务实例
    :return: 英文关键词列表（逗号分隔）
    """
    logger.info("=" * 60)
    logger.info("步骤1: 查询改写")
    logger.info("=" * 60)
    logger.info(f"原始查询: {user_query}")
    
    try:
        keywords = query_rewrite_service.rewrite_query(user_query)
        logger.info(f"提取的关键词: {keywords}")
        return keywords
    except Exception as e:
        logger.error(f"查询改写失败: {e}, 使用原始查询")
        return user_query


# ==============================
# 步骤2: 准备venue列表
# ==============================

def prepare_venues() -> list:
    """
    准备要搜索的venue列表
    :return: [(code, name, type), ...] 列表
    """
    logger.info("=" * 60)
    logger.info("步骤2: 准备Venue列表")
    logger.info("=" * 60)
    
    venues = []
    if SEARCH_JOURNAL:
        for code, name in JOURNAL_VENUES.items():
            if selected_venue_list is None or code in selected_venue_list:
                venues.append((code, name, "JOURNAL"))
    if SEARCH_CONFERENCE:
        for code, name in CONFERENCE_VENUES.items():
            if selected_venue_list is None or code in selected_venue_list:
                venues.append((code, name, "CONFERENCE"))
    
    logger.info(f"共 {len(venues)} 个venue需要搜索")
    if selected_venue_list:
        logger.info(f"选定的venues: {', '.join(selected_venue_list)}")
    return venues


# ==============================
# 步骤3: 并行搜索CrossRef
# ==============================

def search_crossref_parallel(keyword: str, venues: list, crossref_service: CrossRefService) -> tuple:
    """
    并行搜索所有venues
    :param keyword: 搜索关键词
    :param venues: venue列表
    :param crossref_service: CrossRef服务实例
    :return: (all_results_per_venue, venue_info_map)
    """
    logger.info("=" * 60)
    logger.info("步骤3: 并行搜索CrossRef")
    logger.info("=" * 60)
    logger.info(f"关键词: {keyword}, 年份: [{FROM_YEAR}, {TO_YEAR}], 每个venue返回: {ROWS_EACH}篇")
    
    job_args = []
    venue_info_map = {}
    for idx, (code, name, vtype) in enumerate(venues):
        job_args.append((keyword, code, name, vtype, FROM_YEAR, TO_YEAR, ROWS_EACH))
        venue_info_map[idx] = (code, name, vtype)
    
    all_results_per_venue = [None] * len(venues)
    all_errors = [None] * len(venues)
    
    max_workers = min(MAX_CROSSREF_WORKERS, len(job_args)) or 1
    logger.info(f"使用 {max_workers} 个线程并行搜索")
    
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
    
    completed_count = 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        future_to_index = {
            ex.submit(search_wrapper, job_args[idx]): idx 
            for idx in range(len(job_args))
        }
        
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            code, name, vtype = venue_info_map[idx]
            try:
                results, err = future.result()
                all_results_per_venue[idx] = results
                all_errors[idx] = err
                completed_count += 1
                
                logger.info(f"[{completed_count}/{len(venues)}] {code} ({vtype}): 找到 {len(results)} 篇")
                if err:
                    logger.error(f"  [ERROR] {err}")
            except Exception as e:
                all_results_per_venue[idx] = []
                all_errors[idx] = str(e)
                completed_count += 1
                logger.error(f"[{completed_count}/{len(venues)}] {code} ({vtype}): 执行异常 - {e}")
    
    total_results = sum(len(r) if r else 0 for r in all_results_per_venue)
    logger.info(f"CrossRef搜索完成，共获得 {total_results} 条结果")
    return all_results_per_venue, venue_info_map


# ==============================
# 步骤4: 补充摘要（优化：优先批量，单条兜底）
# ==============================

def supplement_abstracts_single(all_results_per_venue: list, s2_service: SemanticScholarService):
    """
    补充缺失的摘要（优化版本：优先使用批量API，单条兜底）
    :param all_results_per_venue: 所有venue的搜索结果
    :param s2_service: Semantic Scholar服务实例
    """
    logger.info("=" * 60)
    logger.info("步骤4: 补充摘要（优化：批量+单条）")
    logger.info("=" * 60)
    
    # 收集所有需要补充摘要的论文
    papers_need_abstract = []
    for venue_results in all_results_per_venue:
        if not venue_results:
            continue
        for r in venue_results:
            if not r.get("abstract"):
                papers_need_abstract.append((r.get("doi"), r["title"], r.get("year"), r))
    
    if not papers_need_abstract:
        logger.info("没有需要补充摘要的论文")
        return
    
    total_count = len(papers_need_abstract)
    logger.info(f"共 {total_count} 篇论文需要补充摘要")
    
    # 步骤1: 优先使用批量API获取有DOI的论文摘要
    papers_with_doi = [(doi, r) for doi, title, year, r in papers_need_abstract if doi]
    if papers_with_doi:
        logger.info(f"批量获取 {len(papers_with_doi)} 篇有DOI的论文摘要...")
        dois_batch = [doi for doi, r in papers_with_doi]
        s2_batch_map = s2_service.fetch_abstract_batch(dois_batch)
        
        batch_updated = 0
        for doi, r in papers_with_doi:
            if r.get("abstract"):  # 防止重复
                continue
            abs_text = s2_batch_map.get(doi.lower())
            if abs_text:
                r["abstract"] = abs_text
                r["abstract_source"] = "semanticscholar-batch"
                batch_updated += 1
        logger.info(f"批量获取完成: {batch_updated}/{len(papers_with_doi)} 篇成功")
    
    # 步骤2: 对于没有DOI或批量未获取到的论文，使用单条API兜底
    papers_need_single = [
        (doi, title, year, r)
        for doi, title, year, r in papers_need_abstract
        if not r.get("abstract")
    ]
    
    if papers_need_single:
        logger.info(f"单条获取 {len(papers_need_single)} 篇论文的摘要（无DOI或批量未获取到）...")
        single_updated = 0
        single_total = len(papers_need_single)
        
        for idx, (doi, title, year, r) in enumerate(papers_need_single, 1):
            if r.get("abstract"):  # 防止重复
                continue
            try:
                abs_text = s2_service.fetch_abstract_single(doi=doi, title=title, year=year)
                if abs_text:
                    r["abstract"] = abs_text
                    if doi:
                        r["abstract_source"] = "semanticscholar-single"
                    else:
                        r["abstract_source"] = "semanticscholar-title"
                    single_updated += 1
                logger.info(f"[{idx}/{single_total}] {title[:50]}...: {'成功' if abs_text else '未找到'}")
            except Exception as e:
                logger.debug(f"[{idx}/{single_total}] 单条获取摘要失败 ({title[:30]}...): {e}")
        
        logger.info(f"单条补充完成: {single_updated}/{single_total} 篇成功")
    
    # 统计总结
    final_with_abstract = sum(
        1 for venue_results in all_results_per_venue
        if venue_results
        for r in venue_results
        if r.get("abstract")
    )
    logger.info(f"摘要补充完成: 共 {final_with_abstract}/{total_count} 篇论文有摘要")


# ==============================
# 步骤5: 论文过滤
# ==============================

def filter_papers(user_query: str, all_results_per_venue: list, paper_filtering_service: PaperFilteringService) -> list:
    """
    使用LLM过滤论文，只保留符合用户需求的论文
    :param user_query: 用户原始查询
    :param all_results_per_venue: 所有venue的搜索结果
    :param paper_filtering_service: 论文过滤服务实例
    :return: 过滤后的论文列表（扁平化）
    """
    logger.info("=" * 60)
    logger.info("步骤5: 论文过滤")
    logger.info("=" * 60)
    
    # 收集所有论文到一个列表中
    all_papers = []
    for venue_results in all_results_per_venue:
        if not venue_results:
            continue
        for paper in venue_results:
            # 确保论文有必要的字段
            if paper.get("title") and paper.get("abstract"):
                all_papers.append(paper)
    
    if not all_papers:
        logger.info("没有需要过滤的论文")
        return []
    
    logger.info(f"共收集到 {len(all_papers)} 篇论文，开始过滤...")
    
    try:
        filtered_papers = paper_filtering_service.filter_papers(user_query, all_papers)
        logger.info(f"过滤完成: {len(filtered_papers)}/{len(all_papers)} 篇论文符合需求")
        return filtered_papers
    except Exception as e:
        logger.error(f"论文过滤失败: {e}, 返回所有论文")
        return all_papers


# ==============================
# 步骤6: 保存结果
# ==============================

def save_results(filtered_papers: list, keyword: str) -> str:
    """
    保存结果到JSON文件
    :param all_results_per_venue: 所有venue的搜索结果
    :param keyword: 搜索关键词（用于生成文件名）
    :return: 输出文件名
    """
    logger.info("=" * 60)
    logger.info("步骤6: 保存结果")
    logger.info("=" * 60)
    
    papers_to_save = []
    for paper in filtered_papers:
        title = (paper.get("title") or "").strip()
        abstract = (paper.get("abstract") or "").strip()
        url = (paper.get("url") or "").strip()
        venue = (paper.get("venue_code") or "").strip()
        year = paper.get("year")
        
        # 过滤空字段
        if not title or not abstract or not url or not venue:
            continue
        
        papers_to_save.append({
            "title": title,
            "abstract": abstract,
            "url": url,
            "venue": venue,
            "time": year
        })
    
    # 生成输出文件名
    keyword_safe = re.sub(r'[^\w\s-]', '', keyword).strip().replace(' ', '_')
    output_filename = f"papers_{keyword_safe}_{FROM_YEAR}_{TO_YEAR}.json"
    
    try:
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(papers_to_save, f, ensure_ascii=False, indent=2)
        logger.info(f"保存完成: {len(papers_to_save)} 篇论文")
        logger.info(f"文件路径: {output_filename}")
        return output_filename
    except Exception as e:
        logger.error(f"保存结果失败: {e}")
        raise


# ==============================
# 主流程
# ==============================

def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("论文搜索程序启动")
    logger.info("=" * 60)
    
    try:
        # 初始化服务
        llm_service = LLMService()
        query_rewrite_service = QueryRewriteService(llm_service)
        crossref_service = CrossRefService()
        s2_service = SemanticScholarService()
        paper_filtering_service = PaperFilteringService(llm_service, max_workers=MAX_FILTERING_WORKERS)
        
        # 步骤1: 查询改写
        keywords = rewrite_query(KEYWORD, query_rewrite_service)
        
        # 步骤2: 准备venue列表
        venues = prepare_venues()
        if not venues:
            logger.warning("没有可搜索的venue，程序退出")
            return
        
        # 步骤3: 并行搜索CrossRef
        all_results_per_venue, venue_info_map = search_crossref_parallel(
            keywords, venues, crossref_service
        )
        
        # 步骤4: 单条补充摘要
        supplement_abstracts_single(all_results_per_venue, s2_service)
        
        # 步骤5: 论文过滤
        filtered_papers = filter_papers(KEYWORD, all_results_per_venue, paper_filtering_service)
        
        # 步骤6: 保存结果
        output_file = save_results(filtered_papers, keywords)
        
        # 打印总结
        logger.info("=" * 60)
        logger.info("程序执行完成")
        logger.info("=" * 60)
        total_before_filter = sum(len(r) if r else 0 for r in all_results_per_venue)
        logger.info(f"搜索到: {total_before_filter} 篇论文")
        logger.info(f"过滤后: {len(filtered_papers)} 篇论文")
        logger.info(f"输出文件: {output_file}")
        
    except KeyboardInterrupt:
        logger.warning("\n程序被用户中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n程序执行出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
