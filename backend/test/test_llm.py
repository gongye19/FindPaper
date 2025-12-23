"""
测试LLM服务脚本
"""
import sys
import json
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.llm_service import LLMService
from dotenv import load_dotenv

# 加载环境变量
env_path = Path(__file__).parent.parent / ".env.dev"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ 已加载环境变量文件: {env_path}")
else:
    print(f"⚠ 环境变量文件不存在: {env_path}")

def test_llm_basic():
    """测试基本LLM调用"""
    print("=" * 60)
    print("测试1: 基本LLM调用")
    print("=" * 60)
    
    llm_service = LLMService()
    
    if not llm_service.is_available():
        print("❌ LLM服务不可用")
        return
    
    print(f"✓ LLM服务初始化成功")
    print(f"  Model: {llm_service.model}")
    print(f"  Base URL: {llm_service.base_url}")
    
    messages = [
        {"role": "system", "content": "你是一个助手。"},
        {"role": "user", "content": "请说'测试成功'"}
    ]
    
    print("\n发送请求...")
    response = llm_service.chat(messages=messages, temperature=0.3, max_tokens=50)
    
    if response:
        print(f"✓ 响应成功: {response}")
    else:
        print("❌ 响应为空")
    
    return response


def test_llm_json_format():
    """测试JSON格式输出"""
    print("\n" + "=" * 60)
    print("测试2: JSON格式输出")
    print("=" * 60)
    
    llm_service = LLMService()
    
    if not llm_service.is_available():
        print("❌ LLM服务不可用")
        return
    
    prompt = """请分析以下用户查询，提取出核心问题中的关键词及相关关键词，并使用专有的英文学术术语表述。

用户查询：帮我找一些和causal inference相关的论文，主要探讨针对positivity解决的方法

要求：
1. 找出用户核心问题中的关键词及相关关键词
2. 使用专有的英文学术术语表述（如果用户输入是中文，必须转换为对应的英文术语）
3. 输出格式：JSON格式，包含一个"keywords"字段，值为用英文逗号和空格分隔的关键词字符串（例如："causal inference, causality, causal reasoning"）

请以JSON格式输出，格式如下：
{"keywords": "keyword1, keyword2, keyword3"}"""
    
    messages = [
        {"role": "system", "content": "你是一个学术搜索助手，擅长从用户查询中提取核心关键词，并将其转换为标准的英文学术术语。请始终以JSON格式输出结果。"},
        {"role": "user", "content": prompt}
    ]
    
    print("发送请求（JSON格式）...")
    
    # 先直接调用API查看原始响应
    try:
        params = {
            "model": llm_service.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 150,
            "response_format": {"type": "json_object"}
        }
        
        raw_response = llm_service.client.chat.completions.create(**params)
        print(f"✓ 原始响应对象类型: {type(raw_response)}")
        
        if hasattr(raw_response, 'choices') and raw_response.choices:
            choice = raw_response.choices[0]
            if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                raw_content = choice.message.content
                print(f"✓ 原始content: {raw_content}")
                print(f"  content类型: {type(raw_content)}")
    except Exception as e:
        print(f"❌ 直接调用API出错: {e}")
        import traceback
        traceback.print_exc()
    
    # 使用封装的方法
    response_text = llm_service.chat(
        messages=messages,
        temperature=0.3,
        max_tokens=150,
        response_format={"type": "json_object"}
    )
    
    if response_text:
        print(f"✓ 收到响应: {response_text}")
        print(f"  响应类型: {type(response_text)}")
        print(f"  响应长度: {len(response_text)}")
        
        # 尝试解析JSON
        try:
            response_json = json.loads(response_text)
            print(f"✓ JSON解析成功: {response_json}")
            keywords = response_json.get("keywords", "")
            print(f"✓ 提取的关键词: {keywords}")
        except json.JSONDecodeError as e:
            print(f"❌ JSON解析失败: {e}")
            print(f"  原始响应: {response_text}")
    else:
        print("❌ 响应为空")
    
    return response_text


def test_llm_raw_response():
    """测试原始响应结构"""
    print("\n" + "=" * 60)
    print("测试3: 查看原始响应结构")
    print("=" * 60)
    
    llm_service = LLMService()
    
    if not llm_service.is_available():
        print("❌ LLM服务不可用")
        return
    
    messages = [
        {"role": "system", "content": "你是一个助手。"},
        {"role": "user", "content": "请说'测试'"}
    ]
    
    print("发送请求并查看原始响应...")
    
    try:
        params = {
            "model": llm_service.model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 50
        }
        
        response = llm_service.client.chat.completions.create(**params)
        
        print(f"✓ 原始响应对象类型: {type(response)}")
        print(f"✓ 响应对象属性: {dir(response)}")
        
        # 打印所有重要属性
        print(f"\n响应对象重要属性:")
        if hasattr(response, 'id'):
            print(f"  id: {response.id}")
        if hasattr(response, 'model'):
            print(f"  model: {response.model}")
        if hasattr(response, 'created'):
            print(f"  created: {response.created}")
        if hasattr(response, 'usage'):
            print(f"  usage: {response.usage}")
        if hasattr(response, 'service_tier'):
            print(f"  service_tier: {response.service_tier}")
        if hasattr(response, 'system_fingerprint'):
            print(f"  system_fingerprint: {response.system_fingerprint}")
        
        # 检查是否有choices属性
        if hasattr(response, 'choices'):
            print(f"\n✓ 有choices属性")
            print(f"  choices类型: {type(response.choices)}")
            print(f"  choices值: {response.choices}")
            print(f"  choices是否为None: {response.choices is None}")
            print(f"  choices是否为空列表: {response.choices == []}")
            
            if response.choices is not None and len(response.choices) > 0:
                choice = response.choices[0]
                print(f"  choice类型: {type(choice)}")
                print(f"  choice属性: {dir(choice)}")
                
                if hasattr(choice, 'message'):
                    message = choice.message
                    print(f"  message类型: {type(message)}")
                    print(f"  message属性: {dir(message)}")
                    
                    if hasattr(message, 'content'):
                        print(f"  content: {message.content}")
            else:
                print("  ⚠ choices为None或空列表")
                # 尝试查看响应对象的字典表示
                try:
                    print(f"\n  尝试查看响应对象的字典表示:")
                    if hasattr(response, 'model_dump'):
                        dump = response.model_dump()
                        print(f"  model_dump: {dump}")
                    if hasattr(response, 'dict'):
                        dict_repr = response.dict()
                        print(f"  dict: {dict_repr}")
                except Exception as e:
                    print(f"  无法获取字典表示: {e}")
        else:
            print("❌ 没有choices属性")
            
            # 尝试查看响应对象的字典
            if hasattr(response, '__dict__'):
                print(f"  响应对象__dict__: {response.__dict__}")
            
            # 尝试转换为字符串
            print(f"  响应字符串表示: {str(response)[:500]}")
            
    except Exception as e:
        print(f"❌ 调用出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("开始测试LLM服务\n")
    
    # 测试1: 基本调用
    test_llm_basic()
    
    # 测试2: JSON格式
    test_llm_json_format()
    
    # 测试3: 原始响应结构
    test_llm_raw_response()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)
