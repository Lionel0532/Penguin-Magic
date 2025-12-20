#!/usr/bin/env python3
"""
创意库图片迁移脚本
将 creative_ideas.json 中的 base64 图片保存为本地文件
"""

import json
import os
import base64
import uuid

# 路径配置
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
CREATIVE_IMAGES_DIR = os.path.join(BASE_DIR, 'creative_images')
CREATIVE_IDEAS_FILE = os.path.join(DATA_DIR, 'creative_ideas.json')

def main():
    print("=" * 50)
    print("🖼️  创意库图片迁移工具")
    print("=" * 50)
    print()
    
    # 确保目录存在
    os.makedirs(CREATIVE_IMAGES_DIR, exist_ok=True)
    
    # 读取创意库
    if not os.path.exists(CREATIVE_IDEAS_FILE):
        print("❌ 创意库文件不存在")
        return
    
    with open(CREATIVE_IDEAS_FILE, 'r', encoding='utf-8') as f:
        ideas = json.load(f)
    
    print(f"📚 找到 {len(ideas)} 个创意")
    
    migrated = 0
    skipped = 0
    errors = 0
    
    for i, idea in enumerate(ideas):
        title = idea.get('title', f'创意{i}')
        image_url = idea.get('imageUrl', '')
        
        # 跳过已经是本地文件的
        if not image_url or image_url.startswith('/files/'):
            skipped += 1
            continue
        
        # 处理 base64 图片
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
                
                # 更新 imageUrl
                idea['imageUrl'] = f'/files/creative/{filename}'
                
                size_kb = len(image_bytes) // 1024
                print(f"  ✓ [{i+1}/{len(ideas)}] {title[:20]:20s} -> {filename} ({size_kb}KB)")
                migrated += 1
                
            except Exception as e:
                print(f"  ✗ [{i+1}/{len(ideas)}] {title[:20]:20s} -> 错误: {e}")
                errors += 1
        else:
            skipped += 1
    
    # 保存更新后的创意库
    with open(CREATIVE_IDEAS_FILE, 'w', encoding='utf-8') as f:
        json.dump(ideas, f, ensure_ascii=False, indent=2)
    
    print()
    print("=" * 50)
    print(f"✅ 迁移完成!")
    print(f"   已迁移: {migrated} 个")
    print(f"   已跳过: {skipped} 个")
    print(f"   错误:   {errors} 个")
    print()
    
    # 显示文件大小对比
    new_size = os.path.getsize(CREATIVE_IDEAS_FILE)
    print(f"📁 新文件大小: {new_size / 1024 / 1024:.2f} MB")
    print("=" * 50)

if __name__ == '__main__':
    main()
