@echo off
chcp 65001 > nul
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║               企 鹅 工 坊  -  使 用 说 明                 ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
echo.
echo   ═══════════════ 环境要求 ═══════════════
echo.
echo   1. Python 3.10+   下载: https://www.python.org/downloads/
echo      (安装时勾选 "Add Python to PATH")
echo.
echo   2. Node.js 18+    下载: https://nodejs.org/
echo.
echo.
echo   ═══════════════ 使用步骤 ═══════════════
echo.
echo   第一次使用:
echo     1. 双击 "首次安装.bat" 安装依赖
echo     2. 双击 "一键启动.bat" 启动程序
echo.
echo   以后使用:
echo     直接双击 "一键启动.bat" 即可
echo.
echo.
echo   ═══════════════ 文件说明 ═══════════════
echo.
echo   首次安装.bat  - 安装依赖（只需运行一次）
echo   一键启动.bat  - 启动程序
echo   停止服务.bat  - 停止所有服务
echo.
echo   backend\data\   - 创意库和历史记录
echo   backend\input\  - 上传的图片
echo   backend\output\ - 生成的图片
echo.
echo.
pause
