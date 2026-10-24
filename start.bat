@echo off
setlocal
title Multi-Agent Workflow System
set "ROOT=%~dp0"

echo ===================================================
echo Starting Multi-Agent Workflow System
echo 4 Specialist Agents * PowerPoint RAG * MongoDB Atlas
echo ===================================================

if not exist "%ROOT%backend\app\main.py" (
    echo ERROR: Backend files were not found beside start.bat.
    pause
    exit /b 1
)
set "PYTHON="
if exist "%ROOT%.venv\Scripts\python.exe" (
    "%ROOT%.venv\Scripts\python.exe" -c "import fastapi, uvicorn" >nul 2>&1
    if not errorlevel 1 set "PYTHON=%ROOT%.venv\Scripts\python.exe"
)
if not defined PYTHON (
    where python >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Python was not found. Install Python and backend\requirements.txt.
        pause
        exit /b 1
    )
    python -c "import fastapi, uvicorn" >nul 2>&1
    if errorlevel 1 (
        echo ERROR: FastAPI or Uvicorn is missing from the Python environment.
        echo Install backend\requirements.txt, then try again.
        pause
        exit /b 1
    )
    set "PYTHON=python"
)
if not exist "%ROOT%frontend\node_modules\vite\bin\vite.js" (
    echo ERROR: Frontend dependencies are not installed.
    echo Run "npm install" in the frontend folder, then try again.
    pause
    exit /b 1
)

echo [1/2] Starting FastAPI Backend on http://localhost:8000...
start "MultiAgent-Backend" /D "%ROOT%backend" cmd /k ""%PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting React Vite Frontend on http://localhost:5173...
start "MultiAgent-Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

echo.
echo Waiting for the frontend to become available...
set /a attempts=0

:wait_frontend
curl --silent --fail http://127.0.0.1:5173/ >nul 2>&1
if not errorlevel 1 goto open_browser
set /a attempts+=1
if %attempts% geq 30 goto frontend_timeout
ping -n 2 127.0.0.1 >nul
goto wait_frontend

:open_browser
echo Frontend is ready.
echo App UI: http://localhost:5173
echo API Docs: http://localhost:8000/docs
start "" "http://localhost:5173"
exit /b 0

:frontend_timeout
echo ERROR: Frontend did not respond at http://localhost:5173 within 30 seconds.
echo Check the MultiAgent-Frontend window for startup errors.
exit /b 1
