"""
LLM服务：通用的LLM服务，提供基础的聊天接口
"""
import os
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("openai库未安装，LLM功能将不可用。请运行: pip install openai")


class LLMService:
    """通用的LLM服务类，提供基础的聊天接口"""
    
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        """
        初始化LLM服务
        :param api_key: LLM API密钥，如果为None则从环境变量读取
        :param base_url: API基础URL，如果为None则从环境变量读取
        :param model: 模型名称，如果为None则从环境变量读取
        """
        if not OPENAI_AVAILABLE:
            self.client = None
            logger.warning("openai库未安装，LLM功能将不可用")
            return
            
        self.api_key = api_key or os.getenv("LLM_API_KEY")
        self.base_url = base_url or os.getenv("LLM_BASE_URL", "https://api.zhizengzeng.com/v1")
        self.model = model or os.getenv("LLM_MODEL_NAME", "glm-4.7")
        
        if not self.api_key:
            logger.warning("LLM_API_KEY未设置，LLM功能将不可用")
            self.client = None
        else:
            try:
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url
                )
                logger.info(f"LLM服务初始化成功: model={self.model}, base_url={self.base_url}")
            except Exception as e:
                logger.error(f"LLM服务初始化失败: {e}")
                self.client = None
    
    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.3, max_tokens: Optional[int] = None, response_format: Optional[Dict] = None) -> Optional[str]:
        """
        通用的聊天接口
        
        :param messages: 消息列表，格式为 [{"role": "system/user/assistant", "content": "..."}, ...]
        :param temperature: 温度参数，控制输出的随机性
        :param max_tokens: 最大token数
        :param response_format: 响应格式，例如 {"type": "json_object"} 用于JSON格式输出
        :return: 模型返回的文本内容，如果失败返回None
        """
        if not self.client:
            logger.warning("LLM服务不可用")
            return None
        
        try:
            # 参考示例：直接使用client.chat.completions.create
            params = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
            }
            if max_tokens:
                params["max_tokens"] = max_tokens
            # 只有在明确需要时才添加response_format
            if response_format:
                params["response_format"] = response_format
            
            response = self.client.chat.completions.create(**params)
            
            # 检查响应结构
            if not response:
                logger.error("LLM响应为空")
                return None
            
            # 首先检查是否有错误
            error_info = None
            try:
                if hasattr(response, 'error'):
                    error_info = response.error
                elif hasattr(response, 'model_dump'):
                    dump = response.model_dump()
                    if 'error' in dump:
                        error_info = dump['error']
            except:
                pass
            
            if error_info:
                error_msg = error_info.get('message', '未知错误') if isinstance(error_info, dict) else str(error_info)
                error_type = error_info.get('type', 'unknown') if isinstance(error_info, dict) else 'unknown'
                error_code = error_info.get('code', '') if isinstance(error_info, dict) else ''
                logger.error(f"LLM API返回错误: {error_msg} (类型: {error_type}, 代码: {error_code})")
                return None
            
            # 尝试不同的方式访问choices
            choices = None
            try:
                if hasattr(response, 'choices'):
                    # 标准OpenAI格式
                    choices = response.choices
                    logger.debug(f"通过属性访问choices成功，类型: {type(choices)}")
                elif isinstance(response, dict):
                    # 字典格式的响应
                    if 'choices' in response:
                        choices = response['choices']
                        logger.debug("通过字典键访问choices成功")
                    else:
                        logger.error(f"LLM响应格式错误：响应中没有choices字段。响应键: {list(response.keys())}")
                        logger.info(f"完整响应（前500字符）: {str(response)[:500]}")
                        return None
                else:
                    # 尝试查看响应对象的属性
                    logger.error(f"LLM响应格式错误：无法访问choices。响应类型: {type(response)}")
                    try:
                        if hasattr(response, '__dict__'):
                            logger.info(f"响应对象属性: {list(response.__dict__.keys())}")
                        if hasattr(response, '__dir__'):
                            attrs = [attr for attr in dir(response) if not attr.startswith('_')]
                            logger.info(f"响应对象方法/属性: {attrs[:20]}")  # 只显示前20个
                        logger.info(f"响应字符串表示（前500字符）: {str(response)[:500]}")
                    except Exception as e:
                        logger.debug(f"无法获取响应详细信息: {e}")
                    return None
            except Exception as e:
                logger.error(f"访问choices时出错: {e}")
                import traceback
                logger.debug(traceback.format_exc())
                return None
            
            if choices is None:
                logger.error("LLM响应格式错误：choices为None")
                # 尝试查看响应的其他信息
                try:
                    if hasattr(response, 'model_dump'):
                        dump = response.model_dump()
                        logger.debug(f"完整响应dump: {dump}")
                        if 'error' in dump:
                            error_info = dump['error']
                            logger.error(f"发现错误信息: {error_info}")
                except:
                    pass
                return None
            
            if not choices:
                logger.error("LLM响应格式错误：choices为空列表")
                return None
            
            if len(choices) == 0:
                logger.error("LLM响应格式错误：choices列表为空")
                return None
            
            choice = choices[0]
            
            # 尝试不同的方式访问message
            if isinstance(choice, dict):
                message = choice.get('message', {})
                if not message:
                    logger.error("LLM响应格式错误：choice中没有message字段")
                    logger.debug(f"choice内容: {choice}")
                    return None
                content = message.get('content') if isinstance(message, dict) else (message.content if hasattr(message, 'content') else None)
            else:
                if not choice or not hasattr(choice, 'message'):
                    logger.error("LLM响应格式错误：缺少message字段")
                    logger.debug(f"choice类型: {type(choice)}, choice属性: {dir(choice) if hasattr(choice, '__dict__') else 'N/A'}")
                    return None
                
                message = choice.message
                if not message or not hasattr(message, 'content'):
                    logger.error("LLM响应格式错误：缺少content字段")
                    logger.debug(f"message类型: {type(message)}, message属性: {dir(message) if hasattr(message, '__dict__') else 'N/A'}")
                    return None
                
                content = message.content
            
            if content is None:
                logger.warning("LLM返回的content为None")
                return None
            
            result = content.strip()
            return result if result else None
                
        except Exception as e:
            logger.error(f"LLM调用出错: {e}")
            import traceback
            logger.debug(traceback.format_exc())
            return None
    
    def is_available(self) -> bool:
        """检查LLM服务是否可用"""
        return self.client is not None
