@echo off

setlocal
set CI=1

call rush validatePackageJson
if errorlevel 1 (
  echo Validation of package.json files failed
  exit /b %errorlevel%
)

call rush clean
if errorlevel 1 (
  echo Clean failed
  exit /b %errorlevel%
)

call rush rebuild
if errorlevel 1 (
  echo Build failed
  exit /b %errorlevel%
)

call rush lint
if errorlevel 1 (
  echo Lint failed
  exit /b %errorlevel%
)

call npm run test -s
if errorlevel 1 (
  echo Tests failed
  exit /b %errorlevel%
)

echo [92m
echo Safe to push! 
echo [0m