REM Installs local builds of the platform-specific native platform packages for Windows.

if .%ImodelJsRoot% == . goto :missingvar

cd %OutRoot%Winx64\packages\imodeljs-native-platform-node
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64

cd %OutRoot%Winx64\packages\imodeljs-native-platform-electron
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64

cd %ImodelJsRoot%imodeljs-core
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-api         %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-node        %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-node
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-node        %ImodelJsRoot%imodeljs-core\nativePlatformForTests\node_modules\@bentley\imodeljs-native-platform-node
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-electron    %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-electron
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-electron    %ImodelJsRoot%imodeljs-core\nativePlatformForTests\node_modules\@bentley\imodeljs-native-platform-electron
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64          %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-n_8_9-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64          %ImodelJsRoot%imodeljs-core\nativePlatformForTests\node_modules\@bentley\imodeljs-n_8_9-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64       %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64       %ImodelJsRoot%imodeljs-core\nativePlatformForTests\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64

cd %ImodelJsRoot%imodeljs-core

goto :xit

:missingvar
echo Define ImodelJsRoot to point to the parent directory that contains imodeljs-core. For example: set ImodelJsRoot=d:\imjs\

:xit