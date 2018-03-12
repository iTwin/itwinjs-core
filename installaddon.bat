if .%ImodelJsRoot% == . goto :missingvar

REM These installs point the aggregator packages to the local builds of the platform-specific native platform packages.
REM Note: The names of the platform-specific native platform packages are platform-, cpu-, and node/electron version-specific.
cd %OutRoot%Winx64\packages\imodeljs-native-platform-node
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64
cd %OutRoot%Winx64\packages\imodeljs-native-platform-electron
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64

REM Next, install the native platform aggregator and API packages in imodeljs. 
REM Note that you must install these packages in each package that depends on them.
REM Note that you do not install the platform-specific addons in this step. They are nested in the aggregator packages.

cd %ImodelJsRoot%imodeljs-core

xcopy /Y /Q /I %OutRoot%Winx64\packages\imodeljs-native-platform-api\*.*         %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Y /Q /I %OutRoot%Winx64\packages\imodeljs-native-platform-node\*.*        %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-node
xcopy /Y /Q /I %OutRoot%Winx64\packages\imodeljs-native-platform-electron\*.*    %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-electron
xcopy /Y /Q /I %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64\addon\*.*       %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-n_8_9-win32-x64\addon
xcopy /Y /Q /I %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64\addon\*.*    %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64\addon

cd %ImodelJsRoot%imodeljs-core

goto :xit

:missingvar
echo Define ImodelJsRoot to point to the parent directory that contains imodeljs-core. For example: set ImodelJsRoot=d:\imjs\

:xit