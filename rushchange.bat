call rush change %*
git status
@echo off
setlocal
set /P "accept=Commit changes (y/n)?"
if "%accept%" == "y" (
@echo on
  git add .
  git commit --amend --no-edit
)
