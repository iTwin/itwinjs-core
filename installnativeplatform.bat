REM Installs local builds of the platform-specific native platform packages for Windows.

set iModelJsCoreDir=%~dp0

cd %OutRoot%Winx64\packages\imodeljs-native-platform-node
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64

cd %OutRoot%Winx64\packages\imodeljs-native-platform-electron
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64

cd %ImodelJsRoot%
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-api         %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-node        %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-native-platform-node
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-node        %iModelJsCoreDir%nativePlatformForTests\node_modules\@bentley\imodeljs-native-platform-node
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-electron    %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-native-platform-electron
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-electron    %iModelJsCoreDir%nativePlatformForTests\node_modules\@bentley\imodeljs-native-platform-electron
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64          %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-n_8_9-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64          %iModelJsCoreDir%nativePlatformForTests\node_modules\@bentley\imodeljs-native-platform-node\node_modules\@bentley\imodeljs-n_8_9-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64       %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64       %iModelJsCoreDir%nativePlatformForTests\node_modules\@bentley\imodeljs-native-platform-electron\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64
