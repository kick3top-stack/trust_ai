# Install backend dependencies (Windows-friendly)
# llama-cpp-python needs prebuilt wheels on Windows (no C++ compiler required)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
pip install fastapi uvicorn pydantic pydantic-settings sqlalchemy aiosqlite cryptography python-multipart httpx PyJWT bcrypt email-validator -q

Write-Host "Installing llama-cpp-python (prebuilt CPU wheel)..." -ForegroundColor Cyan
pip install llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu -q

python -c "from llama_cpp import Llama; print('llama_cpp OK')"
Write-Host "Backend dependencies ready." -ForegroundColor Green
