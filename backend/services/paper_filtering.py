"""
论文过滤服务：使用LLM判断论文是否符合用户需求
"""
import logging
from typing import List, Dict, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
from services.llm_service import LLMService

logger = logging.getLogger(__name__)


class PaperFilteringService:
    """论文过滤服务类"""
    
    def __init__(self, llm_service: Optional[LLMService] = None, max_workers: int = 5):
        """
        初始化论文过滤服务
        :param llm_service: LLM服务实例，如果为None则创建新实例
        :param max_workers: 并发处理的最大线程数
        """
        self.llm_service = llm_service or LLMService()
        self.max_workers = max_workers
    
    def is_paper_relevant(self, user_query: str, paper_abstract: str, paper_title: str = "") -> bool:
        """
        判断单篇论文是否符合用户需求
        
        :param user_query: 用户原始查询
        :param paper_abstract: 论文摘要
        :param paper_title: 论文标题（可选）
        :return: True表示相关，False表示不相关
        """
        if not self.llm_service.is_available():
            logger.warning("LLM服务不可用，默认保留论文")
            return True
        
        if not paper_abstract or not paper_abstract.strip():
            logger.debug("论文摘要为空，默认不相关")
            return False
        
        try:
            prompt = f"""请判断以下论文是否与用户查询相关。

用户查询：{user_query}

论文标题：{paper_title if paper_title else "未提供"}

论文摘要：
{paper_abstract}

请只回答"是"或"否"，表示论文是否与用户查询相关。"""
            
            messages = [
                {"role": "system", "content": "你是一个学术论文评估助手，擅长判断论文是否与用户查询相关。只回答'是'或'否'。"},
                {"role": "user", "content": prompt}
            ]
            
            response = self.llm_service.chat(
                messages=messages,
                temperature=0.1,  # 使用较低温度以获得更一致的判断
                max_tokens=10
            )
            
            if not response:
                logger.debug("LLM返回空结果，默认保留论文")
                return True
            
            # 判断响应中是否包含"是"或"yes"
            response_lower = response.lower().strip()
            is_relevant = "是" in response_lower or "yes" in response_lower or response_lower.startswith("y")
            
            return is_relevant
                
        except Exception as e:
            logger.error(f"判断论文相关性出错: {e}, 默认保留论文")
            return True
    
    def filter_papers(self, user_query: str, papers: List[Dict]) -> List[Dict]:
        """
        批量过滤论文，判断哪些论文符合用户需求
        
        :param user_query: 用户原始查询
        :param papers: 论文列表，每篇论文应包含 'abstract' 和 'title' 字段
        :return: 过滤后的论文列表（只包含相关的论文）
        """
        if not papers:
            return []
        
        logger.info(f"开始过滤 {len(papers)} 篇论文...")
        
        if not self.llm_service.is_available():
            logger.warning("LLM服务不可用，返回所有论文")
            return papers
        
        def filter_single(paper: Dict) -> tuple:
            """单篇论文过滤的包装函数"""
            title = paper.get("title", "")
            abstract = paper.get("abstract", "")
            is_relevant = self.is_paper_relevant(user_query, abstract, title)
            return paper, is_relevant
        
        filtered_papers = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_paper = {
                executor.submit(filter_single, paper): paper 
                for paper in papers
            }
            
            completed = 0
            for future in as_completed(future_to_paper):
                try:
                    paper, is_relevant = future.result()
                    completed += 1
                    if is_relevant:
                        filtered_papers.append(paper)
                        logger.debug(f"[{completed}/{len(papers)}] 保留: {paper.get('title', '')[:50]}...")
                    else:
                        logger.debug(f"[{completed}/{len(papers)}] 过滤: {paper.get('title', '')[:50]}...")
                except Exception as e:
                    paper = future_to_paper[future]
                    logger.error(f"过滤论文时出错 ({paper.get('title', '')[:30]}...): {e}")
                    # 出错时默认保留
                    filtered_papers.append(paper)
        
        logger.info(f"过滤完成: {len(filtered_papers)}/{len(papers)} 篇论文符合需求")
        return filtered_papers
