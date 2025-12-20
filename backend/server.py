"""
企鹅工坊 - 本地Python后端服务
参考 ComfyUI 的设计理念：
- input/ 目录存储用户上传的输入文件
- output/ 目录存储生成的输出文件
- data/ 目录存储创意库和历史记录等数据

启动方式: python server.py
默认端口: 8765
"""

import os
import json
import uuid
import base64
import shutil
import ctypes
from ctypes import wintypes
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import mimetypes

# ============== 配置 ==============
HOST = '127.0.0.1'
PORT = 8765
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR = os.path.join(BASE_DIR, 'input')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
DATA_DIR = os.path.join(BASE_DIR, 'data')
CREATIVE_IMAGES_DIR = os.path.join(BASE_DIR, 'creative_images')  # 创意库图片目录

# 获取系统桌面路径
def get_desktop_path():
    """获取用户桌面路径"""
    try:
        # Windows 方式
        CSIDL_DESKTOP = 0
        buf = ctypes.create_unicode_buffer(wintypes.MAX_PATH)
        ctypes.windll.shell32.SHGetFolderPathW(None, CSIDL_DESKTOP, None, 0, buf)
        return buf.value
    except:
        # 回退到通用方式
        return os.path.join(os.path.expanduser("~"), "Desktop")

DESKTOP_DIR = get_desktop_path()

# 数据文件路径
CREATIVE_IDEAS_FILE = os.path.join(DATA_DIR, 'creative_ideas.json')
HISTORY_FILE = os.path.join(DATA_DIR, 'history.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
DESKTOP_ITEMS_FILE = os.path.join(DATA_DIR, 'desktop_items.json')

# ============== 初始化目录 ==============
def init_directories():
    """创建必要的目录结构"""
    for dir_path in [INPUT_DIR, OUTPUT_DIR, DATA_DIR, CREATIVE_IMAGES_DIR]:
        os.makedirs(dir_path, exist_ok=True)
        print(f"✓ 目录就绪: {dir_path}")
    
    # 初始化数据文件
    if not os.path.exists(CREATIVE_IDEAS_FILE):
        save_json(CREATIVE_IDEAS_FILE, [])
        print(f"✓ 创建创意库文件: {CREATIVE_IDEAS_FILE}")
    
    if not os.path.exists(HISTORY_FILE):
        save_json(HISTORY_FILE, [])
        print(f"✓ 创建历史记录文件: {HISTORY_FILE}")
    
    if not os.path.exists(SETTINGS_FILE):
        save_json(SETTINGS_FILE, {"theme": "dark"})
        print(f"✓ 创建设置文件: {SETTINGS_FILE}")
    
    if not os.path.exists(DESKTOP_ITEMS_FILE):
        save_json(DESKTOP_ITEMS_FILE, [])
        print(f"✓ 创建桌面数据文件: {DESKTOP_ITEMS_FILE}")

# ============== JSON 工具函数 ==============
def load_json(file_path):
    """加载JSON文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []

def save_json(file_path, data):
    """保存JSON文件"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ============== 文件处理函数 ==============
def save_image_file(image_data, filename=None, target_dir=OUTPUT_DIR):
    """保存图片文件到指定目录"""
    if not filename:
        ext = '.png'
        if image_data.startswith('data:'):
            # 解析 data URL
            header, data = image_data.split(',', 1)
            if 'jpeg' in header or 'jpg' in header:
                ext = '.jpg'
            elif 'png' in header:
                ext = '.png'
            elif 'webp' in header:
                ext = '.webp'
            image_data = data
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"penguin_{timestamp}_{uuid.uuid4().hex[:8]}{ext}"
    
    file_path = os.path.join(target_dir, filename)
    
    # 解码 base64 并保存
    try:
        if image_data.startswith('data:'):
            _, image_data = image_data.split(',', 1)
        
        image_bytes = base64.b64decode(image_data)
        with open(file_path, 'wb') as f:
            f.write(image_bytes)
        
        return {
            'success': True,
            'data': {
                'filename': filename,
                'path': file_path,
                'url': f'/files/output/{filename}'
            }
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def list_files(directory, extensions=None):
    """列出目录中的文件"""
    if not os.path.exists(directory):
        return []
    
    files = []
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        if os.path.isfile(file_path):
            if extensions is None or any(filename.lower().endswith(ext) for ext in extensions):
                stat = os.stat(file_path)
                files.append({
                    'name': filename,
                    'size': stat.st_size,
                    'created': stat.st_ctime,
                    'modified': stat.st_mtime,
                })
    
    # 按修改时间倒序排列
    files.sort(key=lambda x: x['modified'], reverse=True)
    return files

def process_creative_image(idea):
    """处理创意的 imageUrl，将 base64 保存为文件"""
    image_url = idea.get('imageUrl', '')
    
    # 如果已经是本地文件 URL，直接返回
    if not image_url or image_url.startswith('/files/'):
        return idea
    
    # 如果是 base64，保存到文件
    if image_url.startswith('data:'):
        try:
            # 解析扩展名
            ext = '.png'
            if 'jpeg' in image_url or 'jpg' in image_url:
                ext = '.jpg'
            elif 'webp' in image_url:
                ext = '.webp'
            elif 'gif' in image_url:
                ext = '.gif'
            
            # 生成文件名
            filename = f"creative_{uuid.uuid4().hex[:12]}{ext}"
            file_path = os.path.join(CREATIVE_IMAGES_DIR, filename)
            
            # 提取 base64 数据
            _, data = image_url.split(',', 1)
            image_bytes = base64.b64decode(data)
            
            # 保存文件
            with open(file_path, 'wb') as f:
                f.write(image_bytes)
            
            # 更新 imageUrl 为本地路径
            idea['imageUrl'] = f'/files/creative/{filename}'
            print(f"  ✓ 图片已保存: {filename} ({len(image_bytes) // 1024}KB)")
        except Exception as e:
            print(f"  ✗ 图片保存失败: {e}")
    
    return idea

# ============== HTTP 请求处理器 ==============
class PenguinHandler(BaseHTTPRequestHandler):
    """HTTP请求处理器"""
    
    def send_cors_headers(self):
        """发送CORS头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def send_json_response(self, data, status=200):
        """发送JSON响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    
    def send_file_response(self, file_path):
        """发送文件响应"""
        if not os.path.exists(file_path):
            self.send_json_response({'success': False, 'error': '文件不存在'}, 404)
            return
        
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = 'application/octet-stream'
        
        self.send_response(200)
        self.send_header('Content-Type', mime_type)
        self.send_header('Cache-Control', 'max-age=31536000')
        self.send_cors_headers()
        self.end_headers()
        
        with open(file_path, 'rb') as f:
            self.wfile.write(f.read())
    
    def parse_body(self):
        """解析请求体"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        
        body = self.rfile.read(content_length)
        try:
            return json.loads(body.decode('utf-8'))
        except json.JSONDecodeError:
            return {}
    
    def do_OPTIONS(self):
        """处理 OPTIONS 请求（CORS预检）"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        
        # 静态文件服务
        if path.startswith('/files/output/'):
            filename = path.replace('/files/output/', '')
            file_path = os.path.join(OUTPUT_DIR, filename)
            self.send_file_response(file_path)
            return
        
        if path.startswith('/files/input/'):
            filename = path.replace('/files/input/', '')
            file_path = os.path.join(INPUT_DIR, filename)
            self.send_file_response(file_path)
            return
        
        # 创意库图片静态文件服务
        if path.startswith('/files/creative/'):
            filename = path.replace('/files/creative/', '')
            file_path = os.path.join(CREATIVE_IMAGES_DIR, filename)
            self.send_file_response(file_path)
            return
        
        # API 路由
        if path == '/api/creative-ideas':
            ideas = load_json(CREATIVE_IDEAS_FILE)
            self.send_json_response({'success': True, 'data': ideas})
            return
        
        if path.startswith('/api/creative-ideas/'):
            idea_id = int(path.split('/')[-1])
            ideas = load_json(CREATIVE_IDEAS_FILE)
            idea = next((i for i in ideas if i['id'] == idea_id), None)
            if idea:
                self.send_json_response({'success': True, 'data': idea})
            else:
                self.send_json_response({'success': False, 'error': '创意不存在'}, 404)
            return
        
        if path == '/api/history':
            history = load_json(HISTORY_FILE)
            self.send_json_response({'success': True, 'data': history})
            return
        
        if path == '/api/files/output':
            files = list_files(OUTPUT_DIR, ['.png', '.jpg', '.jpeg', '.webp', '.gif'])
            self.send_json_response({'success': True, 'data': files})
            return
        
        if path == '/api/files/input':
            files = list_files(INPUT_DIR, ['.png', '.jpg', '.jpeg', '.webp', '.gif'])
            self.send_json_response({'success': True, 'data': files})
            return
        
        if path == '/api/settings':
            settings = load_json(SETTINGS_FILE)
            self.send_json_response({'success': True, 'data': settings})
            return
        
        if path == '/api/desktop':
            desktop_items = load_json(DESKTOP_ITEMS_FILE)
            self.send_json_response({'success': True, 'data': desktop_items})
            return
        
        if path == '/api/status':
            self.send_json_response({
                'success': True,
                'data': {
                    'status': 'running',
                    'version': '1.0.0',
                    'mode': 'local',
                    'input_dir': INPUT_DIR,
                    'output_dir': OUTPUT_DIR,
                }
            })
            return
        
        self.send_json_response({'success': False, 'error': '未知路由'}, 404)
    
    def do_POST(self):
        """处理 POST 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        
        # 保存图片到 output 目录
        if path == '/api/files/save-output':
            image_data = body.get('imageData')
            filename = body.get('filename')
            
            if not image_data:
                self.send_json_response({'success': False, 'error': '缺少图片数据'}, 400)
                return
            
            result = save_image_file(image_data, filename, OUTPUT_DIR)
            self.send_json_response(result)
            return
        
        # 保存图片到 input 目录
        if path == '/api/files/save-input':
            image_data = body.get('imageData')
            filename = body.get('filename')
            
            if not image_data:
                self.send_json_response({'success': False, 'error': '缺少图片数据'}, 400)
                return
            
            result = save_image_file(image_data, filename, INPUT_DIR)
            self.send_json_response(result)
            return
        
        # 保存图片到系统桌面
        if path == '/api/files/save-desktop':
            image_data = body.get('imageData')
            filename = body.get('filename')
            
            if not image_data:
                self.send_json_response({'success': False, 'error': '缺少图片数据'}, 400)
                return
            
            result = save_image_file(image_data, filename, DESKTOP_DIR)
            if result.get('success'):
                result['desktop_path'] = DESKTOP_DIR
            self.send_json_response(result)
            return
        
        # 创建创意
        if path == '/api/creative-ideas':
            ideas = load_json(CREATIVE_IDEAS_FILE)
            
            # 生成新 ID
            new_id = max([i.get('id', 0) for i in ideas], default=0) + 1
            body['id'] = new_id
            body['createdAt'] = datetime.now().isoformat()
            body['updatedAt'] = datetime.now().isoformat()
            
            # 处理图片：将 base64 保存为文件
            body = process_creative_image(body)
            
            ideas.append(body)
            save_json(CREATIVE_IDEAS_FILE, ideas)
            
            self.send_json_response({'success': True, 'data': body})
            return
        
        # 批量导入创意（去重：标题+提示词相同则跳过）
        if path == '/api/creative-ideas/import':
            new_ideas = body.get('ideas', [])
            ideas = load_json(CREATIVE_IDEAS_FILE)
            
            # 创建现有创意的特征集合（标题 + 提示词）
            existing_set = set()
            for idea in ideas:
                title = idea.get('title', '').strip().lower()
                prompt = idea.get('prompt', '').strip().lower()
                existing_set.add((title, prompt))
            
            max_id = max([i.get('id', 0) for i in ideas], default=0)
            imported = []
            skipped = 0
            
            for idea in new_ideas:
                # 检查是否已存在
                title = idea.get('title', '').strip().lower()
                prompt = idea.get('prompt', '').strip().lower()
                
                if (title, prompt) in existing_set:
                    # 已存在，跳过
                    skipped += 1
                    continue
                
                # 新创意，添加到库中
                max_id += 1
                idea['id'] = max_id
                idea['createdAt'] = datetime.now().isoformat()
                idea['updatedAt'] = datetime.now().isoformat()
                
                # 处理图片：将 base64 保存为文件
                idea = process_creative_image(idea)
                
                ideas.append(idea)
                imported.append(idea)
                
                # 添加到特征集合，防止同一批重复
                existing_set.add((title, prompt))
            
            save_json(CREATIVE_IDEAS_FILE, ideas)
            self.send_json_response({
                'success': True, 
                'data': imported,
                'imported': len(imported),
                'skipped': skipped,
                'message': f'导入成功: {len(imported)} 个新创意' + (f', 跳过 {skipped} 个重复' if skipped > 0 else '')
            })
            return
        
        # 重新排序创意
        if path == '/api/creative-ideas/reorder':
            ordered_ids = body.get('orderedIds', [])
            ideas = load_json(CREATIVE_IDEAS_FILE)
            
            # 创建 ID 到索引的映射
            id_to_idea = {i['id']: i for i in ideas}
            
            # 按新顺序重排
            reordered = []
            for idx, idea_id in enumerate(ordered_ids):
                if idea_id in id_to_idea:
                    idea = id_to_idea[idea_id]
                    idea['order'] = idx
                    reordered.append(idea)
            
            # 添加未在列表中的创意
            for idea in ideas:
                if idea['id'] not in ordered_ids:
                    reordered.append(idea)
            
            save_json(CREATIVE_IDEAS_FILE, reordered)
            self.send_json_response({'success': True, 'message': '排序已更新'})
            return
        
        # 保存历史记录
        if path == '/api/history':
            history = load_json(HISTORY_FILE)
            
            # 生成新 ID
            new_id = max([h.get('id', 0) for h in history], default=0) + 1
            body['id'] = new_id
            body['timestamp'] = body.get('timestamp', int(datetime.now().timestamp() * 1000))
            
            history.insert(0, body)  # 新记录插入到开头
            
            # 限制历史记录数量（最多保留500条）
            history = history[:500]
            
            save_json(HISTORY_FILE, history)
            self.send_json_response({'success': True, 'data': body})
            return
        
        # 保存设置
        if path == '/api/settings':
            save_json(SETTINGS_FILE, body)
            self.send_json_response({'success': True, 'data': body})
            return
        
        # 保存桌面状态
        if path == '/api/desktop':
            save_json(DESKTOP_ITEMS_FILE, body.get('items', []))
            self.send_json_response({'success': True, 'message': '桌面状态已保存'})
            return
        
        self.send_json_response({'success': False, 'error': '未知路由'}, 404)
    
    def do_PUT(self):
        """处理 PUT 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        body = self.parse_body()
        
        # 更新创意
        if path.startswith('/api/creative-ideas/'):
            idea_id = int(path.split('/')[-1])
            ideas = load_json(CREATIVE_IDEAS_FILE)
            
            updated = False
            for i, idea in enumerate(ideas):
                if idea['id'] == idea_id:
                    body['id'] = idea_id
                    body['updatedAt'] = datetime.now().isoformat()
                    body['createdAt'] = idea.get('createdAt', datetime.now().isoformat())
                    ideas[i] = {**idea, **body}
                    updated = True
                    break
            
            if updated:
                save_json(CREATIVE_IDEAS_FILE, ideas)
                self.send_json_response({'success': True, 'data': ideas[i]})
            else:
                self.send_json_response({'success': False, 'error': '创意不存在'}, 404)
            return
        
        self.send_json_response({'success': False, 'error': '未知路由'}, 404)
    
    def do_DELETE(self):
        """处理 DELETE 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        # 删除创意
        if path.startswith('/api/creative-ideas/'):
            idea_id = int(path.split('/')[-1])
            ideas = load_json(CREATIVE_IDEAS_FILE)
            
            original_len = len(ideas)
            ideas = [i for i in ideas if i['id'] != idea_id]
            
            if len(ideas) < original_len:
                save_json(CREATIVE_IDEAS_FILE, ideas)
                self.send_json_response({'success': True, 'message': '删除成功'})
            else:
                self.send_json_response({'success': False, 'error': '创意不存在'}, 404)
            return
        
        # 删除历史记录
        if path.startswith('/api/history/'):
            history_id = int(path.split('/')[-1])
            history = load_json(HISTORY_FILE)
            
            original_len = len(history)
            history = [h for h in history if h['id'] != history_id]
            
            if len(history) < original_len:
                save_json(HISTORY_FILE, history)
                self.send_json_response({'success': True, 'message': '删除成功'})
            else:
                self.send_json_response({'success': False, 'error': '记录不存在'}, 404)
            return
        
        # 清空所有历史记录
        if path == '/api/history':
            save_json(HISTORY_FILE, [])
            self.send_json_response({'success': True, 'message': '历史记录已清空'})
            return
        
        # 删除文件
        if path.startswith('/api/files/output/'):
            filename = path.replace('/api/files/output/', '')
            file_path = os.path.join(OUTPUT_DIR, filename)
            
            if os.path.exists(file_path):
                os.remove(file_path)
                self.send_json_response({'success': True, 'message': '文件已删除'})
            else:
                self.send_json_response({'success': False, 'error': '文件不存在'}, 404)
            return
        
        if path.startswith('/api/files/input/'):
            filename = path.replace('/api/files/input/', '')
            file_path = os.path.join(INPUT_DIR, filename)
            
            if os.path.exists(file_path):
                os.remove(file_path)
                self.send_json_response({'success': True, 'message': '文件已删除'})
            else:
                self.send_json_response({'success': False, 'error': '文件不存在'}, 404)
            return
        
        self.send_json_response({'success': False, 'error': '未知路由'}, 404)
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {args[0]}")


# ============== 主函数 ==============
def main():
    print("=" * 50)
    print("🐧 企鹅工坊 - 本地后端服务")
    print("=" * 50)
    print()
    
    # 初始化目录
    init_directories()
    print()
    
    # 启动服务器
    server = HTTPServer((HOST, PORT), PenguinHandler)
    print(f"🚀 服务器启动成功!")
    print(f"   地址: http://{HOST}:{PORT}")
    print(f"   输入目录: {INPUT_DIR}")
    print(f"   输出目录: {OUTPUT_DIR}")
    print(f"   数据目录: {DATA_DIR}")
    print()
    print("按 Ctrl+C 停止服务器...")
    print("-" * 50)
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n🛑 服务器已停止")
        server.shutdown()


if __name__ == '__main__':
    main()
