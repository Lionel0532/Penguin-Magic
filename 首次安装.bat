@echo off
chcp 65001 > nul
title 🐧 企鹅工坊 - 首次安装
cd /d "%~dp0"
color 0B

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║          🐧  企 鹅 工 坊  -  首 次 安 装  🐧            ║
echo  ║                                                          ║
echo  ║         Penguin Magic - First Time Setup                 ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ========== 检查环境 ==========
echo  [1/3] 检查运行环境...
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ❌ 未找到 Python！
    echo.
    echo  请先安装 Python 3.10 或更高版本:
    echo  下载地址: https://www.python.org/downloads/
    echo.
    echo  安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo  ✓ Python %PYTHON_VER%

where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ❌ 未找到 Node.js！
    echo.
    echo  请先安装 Node.js 18 或更高版本:
    echo  下载地址: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version 2^>^&1') do set NODE_VER=%%i
echo  ✓ Node.js %NODE_VER%
echo.

:: ========== 安装前端依赖 ==========
echo  [2/3] 安装前端依赖 (npm install)...
echo        这可能需要几分钟，请耐心等待...
echo.

call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ❌ 前端依赖安装失败！
    echo     请检查网络连接后重试
    pause
    exit /b 1
)

echo.
echo  ✓ 前端依赖安装完成
echo.

:: ========== 创建数据目录 ==========
echo  [3/3] 初始化数据目录...

if not exist "backend\data" mkdir "backend\data"
if not exist "backend\input" mkdir "backend\input"
if not exist "backend\output" mkdir "backend\output"

echo  ✓ 数据目录已创建
echo.

:: ========== 完成 ==========
color 0A
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║                                                          ║
echo  ║              ✨ 安装完成！ ✨                            ║
echo  ║                                                          ║
echo  ║   现在可以双击 "一键启动.bat" 运行程序了               ║
echo  ║                                                          ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
