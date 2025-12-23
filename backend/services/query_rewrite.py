"""
查询改写服务：使用LLM将用户查询转换为清晰的搜索关键词
"""
import logging
from typing import Optional
from services.llm_service import LLMService

logger = logging.getLogger(__name__)


class QueryRewriteService:
    """查询改写服务类"""
    
    def __init__(self, llm_service: Optional[LLMService] = None):
        """
        初始化查询改写服务
        :param llm_service: LLM服务实例，如果为None则创建新实例
        """
        self.llm_service = llm_service or LLMService()
    
    def rewrite_query(self, user_query: str) -> str:
        """
        将用户查询改写为英文关键词列表（逗号分隔）
        
        :param user_query: 用户原始查询（可以是中文或英文）
        :return: 英文关键词列表，用逗号分隔（例如："causal inference, causality, causal reasoning"）
        """
        if not self.llm_service.is_available():
            logger.warning("LLM服务不可用，返回原始查询")
            return user_query
        
        try:
            import json
            
            prompt = f"""请分析以下用户查询，提取出最核心、最相关的关键词，并使用专有的英文学术术语表述。

用户查询：{user_query}

要求：
1. 只提取最核心、最相关的关键词，最多3个
2. 使用专有的英文学术术语表述（如果用户输入是中文，必须转换为对应的英文术语）
3. 优先选择最能代表用户查询意图的核心术语
4. 输出格式：JSON格式，包含一个"keywords"字段，值为用英文逗号和空格分隔的关键词字符串（最多3个，例如："causal inference, positivity, treatment effect"）

请以JSON格式输出，格式如下：
{{"keywords": "keyword1, keyword2, keyword3"}}"""
            
            messages = [
                {"role": "system", "content": "你是一个学术搜索助手，擅长从用户查询中提取核心关键词，并将其转换为标准的英文学术术语。请始终以JSON格式输出结果。"},
                {"role": "user", "content": prompt}
            ]
            
            # 先尝试使用JSON格式
            response_text = self.llm_service.chat(
                messages=messages,
                temperature=0.3,
                max_tokens=150,
                response_format={"type": "json_object"}
            )
            
            # 如果JSON格式失败，尝试不使用response_format
            if not response_text:
                logger.warning("JSON格式调用失败，尝试不使用response_format")
                response_text = self.llm_service.chat(
                    messages=messages,
                    temperature=0.3,
                    max_tokens=150,
                    response_format=None
                )
            
            if response_text:
                try:
                    # 尝试解析JSON
                    response_json = json.loads(response_text)
                    keywords_str = response_json.get("keywords", "").strip()
                    
                    if keywords_str:
                        logger.info(f"查询改写成功: '{user_query}' -> '{keywords_str}'")
                        return keywords_str
                    else:
                        logger.warning("JSON中未找到keywords字段，尝试直接使用响应文本")
                        # 如果JSON解析失败，尝试直接使用响应文本
                        keywords_str = response_text.strip().strip('"').strip("'").strip('.').strip()
                        return keywords_str if keywords_str else user_query
                except json.JSONDecodeError as e:
                    logger.warning(f"JSON解析失败: {e}，尝试从文本中提取JSON或直接使用响应")
                    # 尝试从文本中提取JSON（可能被markdown代码块包裹）
                    import re
                    json_match = re.search(r'\{[^{}]*"keywords"[^{}]*\}', response_text)
                    if json_match:
                        try:
                            response_json = json.loads(json_match.group(0))
                            keywords_str = response_json.get("keywords", "").strip()
                            if keywords_str:
                                logger.info(f"查询改写成功（从文本提取JSON）: '{user_query}' -> '{keywords_str}'")
                                return keywords_str
                        except:
                            pass
                    
                    # 如果JSON解析失败，尝试直接使用响应文本
                    keywords_str = response_text.strip().strip('"').strip("'").strip('.').strip()
                    if keywords_str:
                        logger.info(f"查询改写成功（非JSON格式）: '{user_query}' -> '{keywords_str}'")
                        return keywords_str
                    else:
                        logger.warning("LLM返回空结果，使用原始查询")
                        return user_query
            else:
                logger.warning("LLM返回空结果，使用原始查询")
                return user_query
                
        except Exception as e:
            logger.error(f"查询改写出错: {e}, 使用原始查询")
            return user_query
