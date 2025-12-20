@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo  🐧 企鹅工坊 - 停止服务
echo.

:: 关闭后端
echo  关闭后端服务 (端口 8765)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8765 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo  ✓ 已关闭 PID: %%a
)

:: 关闭前端
echo  关闭前端服务 (端口 5176)...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5176 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    echo  ✓ 已关闭 PID: %%a
)

:: 关闭相关的cmd窗口
taskkill /f /fi "WINDOWTITLE eq 企鹅工坊-后端" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq 企鹅工坊-前端" >nul 2>&1

echo.
echo  ✓ 所有服务已停止！
echo.
timeout /t 3 > nul
