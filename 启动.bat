@echo off
chcp 65001 >nul
echo ========================================
echo   数学声觉化工具 — 启动中...
echo ========================================
echo.

:: 尝试 Python
where python >nul 2>&1
if %errorlevel%==0 (
    echo 使用 Python 启动本地服务器...
    echo.
    echo 启动后请在浏览器中打开：http://localhost:8080
    echo 按 Ctrl+C 停止服务器
    echo.
    start http://localhost:8080
    python -m http.server 8080
    goto :end
)

:: 尝试 npx
where npx >nul 2>&1
if %errorlevel%==0 (
    echo 使用 Node.js 启动本地服务器...
    echo.
    echo 启动后请在浏览器中打开：http://localhost:8080
    echo 按 Ctrl+C 停止服务器
    echo.
    start http://localhost:8080
    npx -y http-server -p 8080 --cors -c-1
    goto :end
)

:: 都没有
echo.
echo [错误] 未检测到 Python 或 Node.js，无法启动服务器。
echo.
echo 请安装以下任一工具：
echo   - Python:  https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org/
echo.
echo 安装后重新双击此文件即可。
echo.
pause

:end
