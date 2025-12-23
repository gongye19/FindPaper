"""
Semantic Scholar服务：用于从Semantic Scholar API获取论文摘要
"""
import os
import logging
import time
import urllib.parse
import requests
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

S2_BASE = "https://api.semanticscholar.org/graph/v1"


class SemanticScholarService:
    """Semantic Scholar服务类"""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        初始化Semantic Scholar服务
        :param api_key: API密钥，如果为None则从环境变量读取
        """
        self.api_key = api_key or os.getenv("S2_API_KEY")
        self.base_url = S2_BASE
        self.headers = {
            "User-Agent": "find-paper-bot/1.0 (mailto:gy723511500@gmail.com)",
        }
        if self.api_key:
            self.headers["x-api-key"] = self.api_key
        else:
            logger.warning("S2_API_KEY未设置，Semantic Scholar功能将受限")
    
    def fetch_abstract_batch(self, dois: List[str], batch_size: int = 100) -> Dict[str, str]:
        """
        批量获取论文摘要（使用DOI）
        
        :param dois: DOI列表
        :param batch_size: 每批处理的DOI数量
        :return: {doi_lower: abstract} 字典
        """
        if not self.api_key:
            logger.warning("S2_API_KEY未设置，跳过批量获取摘要")
            return {}

        # 去重但保持顺序
        unique_dois = []
        seen = set()
        for d in dois:
            if not d:
                continue
            if d in seen:
                continue
            seen.add(d)
            unique_dois.append(d)

        if not unique_dois:
            return {}

        abs_map = {}
        url = f"{self.base_url}/paper/batch"
        params = {"fields": "abstract"}

        for i in range(0, len(unique_dois), batch_size):
            chunk = unique_dois[i:i + batch_size]
            ids = [f"DOI:{d}" for d in chunk]

            try:
                resp = requests.post(
                    url,
                    params=params,
                    json={"ids": ids},
                    headers=self.headers,
                    timeout=30,
                )
                time.sleep(1.1)  # 1 req/s 限制

                if resp.status_code != 200:
                    logger.warning(f"Semantic Scholar批量API调用失败: {resp.status_code}")
                    continue

                papers = resp.json()
                if not isinstance(papers, list):
                    continue

                # 官方文档：返回顺序与ids对应
                for idx, paper in enumerate(papers):
                    if not paper or idx >= len(chunk):
                        continue
                    abstract = paper.get("abstract")
                    if abstract:
                        doi_real = chunk[idx]
                        abs_map[doi_real.lower()] = abstract

            except requests.exceptions.Timeout:
                logger.error("Semantic Scholar批量API调用超时")
                continue
            except Exception as e:
                logger.error(f"Semantic Scholar批量API调用出错: {e}")
                continue

        logger.info(f"批量获取摘要完成: {len(abs_map)}/{len(unique_dois)} 成功")
        return abs_map
    
    def fetch_abstract_single(self, doi: Optional[str] = None, title: Optional[str] = None, year: Optional[int] = None) -> Optional[str]:
        """
        单条获取论文摘要（兜底方法）
        1) 有DOI就先用DOI查
        2) 没DOI或DOI查不到，再按标题搜索
        
        :param doi: 论文DOI
        :param title: 论文标题
        :param year: 论文年份（用于验证）
        :return: 摘要文本，如果获取失败返回None
        """
        if not self.api_key:
            return None

        # 1) DOI精确查
        if doi:
            try:
                url = f"{self.base_url}/paper/DOI:{urllib.parse.quote(doi)}"
                params = {"fields": "title,abstract,year"}
                resp = requests.get(url, params=params, headers=self.headers, timeout=20)
                time.sleep(1.1)  # 尊重1 req/s
                
                if resp.status_code == 200:
                    data = resp.json()
                    abs_text = data.get("abstract")
                    if abs_text:
                        logger.debug(f"通过DOI获取摘要成功: {doi[:20]}...")
                        return abs_text
            except Exception as e:
                logger.debug(f"DOI查询失败: {e}")

        # 2) 标题搜索兜底
        if title:
            try:
                url = f"{self.base_url}/paper/search"
                params = {
                    "query": title,
                    "limit": 1,
                    "fields": "title,abstract,year",
                }
                resp = requests.get(url, params=params, headers=self.headers, timeout=20)
                time.sleep(1.1)
                
                if resp.status_code != 200:
                    return None
                    
                data = resp.json()
                results = data.get("data", [])
                if not results:
                    return None
                    
                paper = results[0]
                abs_text = paper.get("abstract")
                paper_year = paper.get("year")

                # 年份验证
                if year is not None and paper_year is not None:
                    if abs(paper_year - year) > 2:
                        logger.debug(f"年份不匹配: {year} vs {paper_year}")
                        return None

                if abs_text:
                    logger.debug(f"通过标题获取摘要成功: {title[:30]}...")
                return abs_text or None
            except Exception as e:
                logger.debug(f"标题搜索失败: {e}")
                return None

        return None