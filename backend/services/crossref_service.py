"""
CrossRef服务：用于从CrossRef API搜索论文
"""
import os
import re
import logging
import requests
from typing import List, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

CROSSREF_URL = "https://api.crossref.org/works"
HEADERS_CROSSREF = {
    "User-Agent": "find-paper-bot/1.0 (mailto:gy723511500@gmail.com)"
}


def clean_html(raw: Optional[str]) -> Optional[str]:
    """简单去除HTML标签"""
    if not raw:
        return None
    text = re.sub(r"<[^>]+>", " ", raw)
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    return text or None


def match_conference_locally(venue_code: str, container_title: Optional[str], conference_filters: Dict) -> bool:
    """
    对会议结果做本地venue过滤
    :param venue_code: 会议代码，如 NeurIPS / ICML
    :param container_title: CrossRef返回的container-title
    :param conference_filters: 会议名称过滤器字典
    :return: True/False
    """
    if not container_title:
        return False

    patterns = conference_filters.get(venue_code)
    if not patterns:
        return True  # 没配置过滤规则就不过滤

    text = container_title.lower()
    for pat in patterns:
        if pat in text:
            return True
    return False


class CrossRefService:
    """CrossRef服务类"""
    
    def __init__(self):
        """初始化CrossRef服务"""
        self.base_url = CROSSREF_URL
        self.headers = HEADERS_CROSSREF
    
    def search_one_venue(
        self,
        keyword: str,
        venue_code: str,
        venue_name: str,
        venue_type: str,
        from_year: Optional[int] = None,
        to_year: Optional[int] = None,
        rows: int = 10,
        conference_filters: Optional[Dict] = None
    ) -> List[Dict]:
        """
        搜索一个venue的论文
        
        :param keyword: 搜索关键词
        :param venue_code: venue代码
        :param venue_name: venue名称
        :param venue_type: venue类型 (JOURNAL/CONFERENCE)
        :param from_year: 起始年份
        :param to_year: 结束年份
        :param rows: 返回结果数量
        :param conference_filters: 会议名称过滤器（仅用于CONFERENCE类型）
        :return: 论文结果列表
        """
        try:
            filters = []
            if from_year is not None:
                filters.append(f"from-pub-date:{from_year}")
            if to_year is not None:
                filters.append(f"until-pub-date:{to_year}")

            params = {}

            if venue_type == "JOURNAL":
                filters.append("type:journal-article")
                filters.append(f"container-title:{venue_name}")
                params["query"] = keyword
                params["rows"] = rows
            elif venue_type == "CONFERENCE":
                filters.append("type:proceedings-article")
                params["query"] = keyword
                params["query.container-title"] = venue_name
                params["rows"] = rows * 3  # 多拿一些，后面本地过滤

            if filters:
                params["filter"] = ",".join(filters)

            resp = requests.get(
                self.base_url,
                params=params,
                headers=self.headers,
                timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            items = data.get("message", {}).get("items", [])
            results = []

            for item in items:
                title = item.get("title", ["<no title>"])[0]
                doi = item.get("DOI")
                url = item.get("URL", f"https://doi.org/{doi}") if doi else None
                container = item.get("container-title", [""])[0]

                issued = item.get("issued", {}).get("date-parts", [[None]])[0]
                year = issued[0] if issued else None

                authors_raw = item.get("author", []) or []
                authors = []
                for a in authors_raw:
                    full = f"{a.get('given', '')} {a.get('family', '')}".strip()
                    if full:
                        authors.append(full)

                # 会议加一层本地venue过滤
                if venue_type == "CONFERENCE" and conference_filters:
                    if not match_conference_locally(venue_code, container, conference_filters):
                        continue

                # 只用CrossRef摘要
                abstract_crossref = clean_html(item.get("abstract"))
                abstract_final = abstract_crossref
                abstract_source = "crossref" if abstract_crossref else None

                results.append({
                    "venue_code": venue_code,
                    "venue_type": venue_type,
                    "title": title,
                    "year": year,
                    "journal_or_proceedings": container,
                    "doi": doi,
                    "url": url,
                    "authors": authors,
                    "abstract": abstract_final,
                    "abstract_source": abstract_source,
                })

                if len(results) >= rows:
                    break

            logger.debug(f"CrossRef搜索 {venue_code} 完成，找到 {len(results)} 篇论文")
            return results

        except requests.exceptions.RequestException as e:
            logger.error(f"CrossRef搜索 {venue_code} 请求失败: {e}")
            return []
        except Exception as e:
            logger.error(f"CrossRef搜索 {venue_code} 出错: {e}")
            return []