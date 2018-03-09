if .%ImodelJsRoot% == . goto :missingvar

REM These installs point the aggregator packages to the local builds of the platform-specific addon packages.
REM Note: The names of the platform-specific addon packages are platform-, cpu-, and node/electron version-specific.
cd %OutRoot%Winx64\packages\imodeljs-nodeaddon
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64
cd %OutRoot%Winx64\packages\imodeljs-electronaddon
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64

REM Note: You must re-run the above install command whenever you rebuild the MakePackages part, as that will re-create 
REM         the %OutRoot%Winx64\packages\imodeljs-nodeaddon and %OutRoot%Winx64\packages\imodeljs-electronaddon directories.

REM Next, install the addon aggregator and api packages in imodeljs. 
REM Note that you must install these packages in each package that depends on them.
REM Note that you do not install the platform-specific addons in this step. They are nested in the aggregator packages.

cd %ImodelJsRoot%imodeljs-core

xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-native-platform-api\*.*          %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-native-platform-api
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-nodeaddon\*.*             %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-nodeaddon
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-electronaddon\*.*         %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-electronaddon
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64\addon\*.* %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-n_8_9-win32-x64\addon
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64\addon\*.* %ImodelJsRoot%imodeljs-core\common\temp\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64\addon

REM cd %ImodelJsRoot%imodeljs-core\source\backend
REM call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-nodeaddon %OutRoot%Winx64\packages\imodeljs-electronaddon
REM cd %ImodelJsRoot%imodeljs-core\source\testbed
REM call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-native-platform-api %OutRoot%Winx64\packages\imodeljs-electronaddon
cd %ImodelJsRoot%imodeljs-core

goto :xit

:missingvar
echo Define ImodelJsRoot to point to the parent directory that contains imodeljs-core. For example: set ImodelJsRoot=d:\imjs\

:xit