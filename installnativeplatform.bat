REM Install local build of the platform-specific native platform packages for use by examples and tests
if not exist .\common goto :baddir

xcopy /Q /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-api common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Q /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8-win32-x64    common\temp\node_modules\@bentley\imodeljs-native-platform-api\lib\@bentley\imodeljs-n_8-win32-x64
xcopy /Q /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_2-win32-x64    common\temp\node_modules\@bentley\imodeljs-native-platform-api\lib\@bentley\imodeljs-e_2-win32-x64

REM Create a semaphore file that identifies that this is a dev build, and helps bypass version checks
set libDir=.\core\backend\lib
if not exist %libDir% mkdir %libDir%
echo This is a Development build, and this semaphore helps bypass native version checks > %libDir%\DevBuild.txt
set libDir=

goto :xit
:baddir
echo Change to an imodeljs-core directory before running this script.
:xit