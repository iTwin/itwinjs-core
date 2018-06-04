@echo off
echo Installing local build of the platform-specific native platform packages for use by examples and tests
if not exist .\common goto :baddir
if not exist .\tools goto :baddir
if not exist .\tools\native-platform-installer goto :baddir

xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-api common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8-win32-x64    common\temp\node_modules\@bentley\imodeljs-n_8-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8-win32-x64    tools\native-platform-installer\node_modules\@bentley\imodeljs-native-platform-node\node_modules\@bentley\imodeljs-n_8-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_2-win32-x64    common\temp\node_modules\@bentley\imodeljs-e_2-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_2-win32-x64    tools\native-platform-installer\node_modules\@bentley\imodeljs-native-platform-electron\node_modules\@bentley\imodeljs-e_2-win32-x64

goto :xit
:baddir
echo Change to an imodeljs-core directory before running this script.
:xit