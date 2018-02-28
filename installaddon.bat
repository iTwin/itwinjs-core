set iModelJsCoreDir=%~dp0

REM These installs point the aggregator packages to the local builds of the platform-specific addon packages.
REM Note: The names of the platform-specific addon packages are platform-, cpu-, and node/electron version-specific.
cd %OutRoot%Winx64\packages\imodeljs-nodeaddon
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-nodeaddonapi %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64
cd %OutRoot%Winx64\packages\imodeljs-electronaddon
call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-nodeaddonapi %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64

REM Note: You must re-run the above install command whenever you rebuild the MakePackages part, as that will re-create 
REM         the %OutRoot%Winx64\packages\imodeljs-nodeaddon and %OutRoot%Winx64\packages\imodeljs-electronaddon directories.

REM Next, install the addon aggregator and api packages in imodeljs. 
REM Note that you must install these packages in each package that depends on them.
REM Note that you do not install the platform-specific addons in this step. They are nested in the aggregator packages.

cd %iModelJsCoreDir%

xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-nodeaddonapi\*.*          %iModelJsCoreDir%\common\temp\node_modules\@bentley\imodeljs-nodeaddonapi
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-nodeaddon\*.*             %iModelJsCoreDir%\common\temp\node_modules\@bentley\imodeljs-nodeaddon
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-electronaddon\*.*         %iModelJsCoreDir%\common\temp\node_modules\@bentley\imodeljs-electronaddon
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-n_8_9-win32-x64\addon\*.* %iModelJsCoreDir%\common\temp\node_modules\@bentley\imodeljs-n_8_9-win32-x64\addon
xcopy /Y /Q %OutRoot%Winx64\packages\imodeljs-e_1_6_11-win32-x64\addon\*.* %iModelJsCoreDir%\common\temp\node_modules\@bentley\imodeljs-e_1_6_11-win32-x64\addon

REM cd %iModelJsCoreDir%\source\backend
REM call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-nodeaddonapi %OutRoot%Winx64\packages\imodeljs-nodeaddon %OutRoot%Winx64\packages\imodeljs-electronaddon
REM cd %iModelJsCoreDir%imodeljs-core\source\testbed
REM call npm install --no-save  %OutRoot%Winx64\packages\imodeljs-nodeaddonapi %OutRoot%Winx64\packages\imodeljs-electronaddon
REM cd %iModelJsCoreDir%
