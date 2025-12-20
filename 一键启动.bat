@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo.
echo  🐧 企鹅工坊 - 正在启动...
echo.

:: 关闭已存在的服务
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8765 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5176 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: 启动后端
echo  [1/2] 启动后端服务...
start "企鹅工坊-后端" /min cmd /c "cd /d "%~dp0backend" && python server.py"

:: 等待后端启动
ping 127.0.0.1 -n 3 > nul

:: 启动前端
echo  [2/2] 启动前端服务...
start "企鹅工坊-前端" /min cmd /c "cd /d "%~dp0" && npm run dev"

:: 等待前端启动
echo.
echo  等待服务就绪...
ping 127.0.0.1 -n 6 > nul

:: 打开浏览器
echo.
echo  ✓ 启动完成！正在打开浏览器...
start http://localhost:5176

echo.
echo  ════════════════════════════════════════════════════════
echo.
echo   服务已在后台运行，可以关闭此窗口。
echo.
echo   前端: http://localhost:5176
echo   后端: http://localhost:8765
echo.
echo   如需停止服务，请双击 "停止服务.bat"
echo.
echo  ════════════════════════════════════════════════════════
echo.

timeout /t 5 > nul
