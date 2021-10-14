@echo off
setlocal
set /A iteration = 0
: loop
set /A iteration = %iteration% + 1
echo Iteration: %iteration%
call npm run test -s
goto loop
: end
