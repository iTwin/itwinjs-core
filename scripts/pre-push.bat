@echo off

setlocal
set CI=1

call rush validatePackageJson
if errorlevel 1 (
  echo Validation of package.json files failed
  exit /b %errorlevel%
)

call rush check
if errorlevel 1 (
  echo Rush check failed
  exit /b %errorlevel%
)

call rush change -v
if errorlevel 1 (
  echo Missing Rush change files
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

call rush test+cover
if errorlevel 1 (
  echo Tests failed
  exit /b %errorlevel%
)

echo [92m
echo Safe to push! 
echo [0m