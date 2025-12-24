"""
测试主流程脚本
"""
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.llm_service import LLMService
from services.crossref_service import CrossRefService
from services.semantic_scholar_service import SemanticScholarService
from services.query_rewrite import QueryRewriteService
from services.paper_filtering import PaperFilteringService
from config import MAX_FILTERING_WORKERS
import main
from dotenv import load_dotenv

# 加载环境变量
env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

# 测试参数
TEST_QUERY = "帮我找一些和causal inference相关的论文，主要探讨针对positivity解决的方法"
FROM_YEAR = 2024
TO_YEAR = 2025
ROWS_EACH = 3

# 设置main模块的全局变量
main.KEYWORD = TEST_QUERY
main.FROM_YEAR = FROM_YEAR
main.TO_YEAR = TO_YEAR
main.ROWS_EACH = ROWS_EACH
main.SELECTED_VENUES = "all"
main.selected_venue_list = None
main.SEARCH_JOURNAL = True
main.SEARCH_CONFERENCE = True

def test_main_flow():
    """测试主流程"""
    print("=" * 60)
    print("开始测试主流程")
    print("=" * 60)
    
    # 初始化服务
    print("\n[1] 初始化服务...")
    llm_service = LLMService()
    query_rewrite_service = QueryRewriteService(llm_service)
    crossref_service = CrossRefService()
    s2_service = SemanticScholarService()
    paper_filtering_service = PaperFilteringService(llm_service, max_workers=MAX_FILTERING_WORKERS)
    print("✓ 服务初始化完成")
    
    # 步骤1: 查询改写
    print(f"\n[2] 查询改写: {TEST_QUERY}")
    keywords = main.rewrite_query(TEST_QUERY, query_rewrite_service)
    print(f"✓ 提取的关键词: {keywords}")
    
    # 步骤2: 准备venue列表
    print("\n[3] 准备venue列表...")
    venues = main.prepare_venues()
    print(f"✓ 共 {len(venues)} 个venue")
    
    # 步骤3: 并行搜索
    print(f"\n[4] 搜索论文 (关键词: {keywords}, 年份: {FROM_YEAR}-{TO_YEAR})...")
    all_results_per_venue, _ = main.search_crossref_parallel(
        keywords, venues, crossref_service
    )
    total_papers = sum(len(r) if r else 0 for r in all_results_per_venue)
    print(f"✓ 搜索完成，找到 {total_papers} 篇论文")
    
    # 步骤4: 补充摘要
    print("\n[5] 补充摘要...")
    main.supplement_abstracts_single(all_results_per_venue, s2_service)
    papers_with_abstract = sum(
        sum(1 for p in (r or []) if p.get("abstract"))
        for r in all_results_per_venue
    )
    print(f"✓ 补充完成，{papers_with_abstract}/{total_papers} 篇有摘要")
    
    # 步骤5: 过滤论文
    print(f"\n[6] 过滤论文 (原始查询: {TEST_QUERY})...")
    filtered_papers = main.filter_papers(TEST_QUERY, all_results_per_venue, paper_filtering_service)
    print(f"✓ 过滤完成，剩余 {len(filtered_papers)} 篇论文")
    
    # 打印结果
    print("\n" + "=" * 60)
    print("测试结果")
    print("=" * 60)
    print(f"原始查询: {TEST_QUERY}")
    print(f"提取的关键词: {keywords}")
    print(f"搜索到论文: {total_papers} 篇")
    print(f"过滤后论文: {len(filtered_papers)} 篇")
    
    if filtered_papers:
        print(f"\n前3篇论文:")
        for i, paper in enumerate(filtered_papers[:3], 1):
            print(f"\n[{i}] {paper.get('title', 'N/A')}")
            print(f"    Venue: {paper.get('venue_code', 'N/A')} ({paper.get('venue_type', 'N/A')})")
            print(f"    Year: {paper.get('year', 'N/A')}")
            print(f"    DOI: {paper.get('doi', 'N/A')}")
            abstract = paper.get('abstract', '')
            if abstract:
                print(f"    Abstract: {abstract[:100]}...")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_main_flow()
