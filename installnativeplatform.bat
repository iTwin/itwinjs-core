REM Installs local builds of the platform-specific native platform packages for Windows.

set iModelJsCoreDir=%~dp0

cd %ImodelJsRoot%
xcopy /Y /I %OutRoot%Winx64\packages\imodeljs-native-platform-api %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8-win32-x64    %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-n_8-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-n_8-win32-x64    %iModelJsCoreDir%tools\native-platform-installer\node_modules\@bentley\imodeljs-native-platform-node\node_modules\@bentley\imodeljs-n_8-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_2-win32-x64    %iModelJsCoreDir%common\temp\node_modules\@bentley\imodeljs-e_2-win32-x64
xcopy /Y /I /S %OutRoot%Winx64\packages\imodeljs-e_2-win32-x64    %iModelJsCoreDir%tools\native-platform-installer\node_modules\@bentley\imodeljs-native-platform-electron\node_modules\@bentley\imodeljs-e_2-win32-x64
popd