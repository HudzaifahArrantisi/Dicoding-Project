@echo off
rem deploy.cmd - menjalankan deploy.sh lewat Git Bash.
rem
rem Pemakaian (dari cmd atau PowerShell):
rem   deploy.cmd
rem   deploy.cmd -m "feat: sesuatu"
rem   deploy.cmd --skip-build
rem   deploy.cmd --dry-run
rem
rem Wrapper ini mencari bash.exe dari Git for Windows / Git bawaan Laragon.
rem Jangan memakai "bash" dari PATH karena di Windows biasanya itu stub WSL.

setlocal

set "BASH="

for %%P in (
  "%ProgramFiles%\Git\bin\bash.exe"
  "%ProgramFiles(x86)%\Git\bin\bash.exe"
  "%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
  "C:\laragon\bin\git\bin\bash.exe"
) do (
  if not defined BASH if exist "%%~P" set "BASH=%%~P"
)

if not defined BASH (
  for %%G in (git.exe) do (
    if not defined BASH if exist "%%~dpG..\bin\bash.exe" set "BASH=%%~dpG..\bin\bash.exe"
  )
)

if not defined BASH (
  echo deploy: Git Bash tidak ditemukan.
  echo         Pasang Git for Windows, atau jalankan lewat aplikasi Git Bash langsung.
  exit /b 2
)

"%BASH%" "%~dp0deploy.sh" %*
exit /b %ERRORLEVEL%
