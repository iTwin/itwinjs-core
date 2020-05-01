/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  DebugShaderFile,
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
  Tool,
} from "@bentley/imodeljs-frontend";
import SVTRpcInterface from "../common/SVTRpcInterface";

const makeShadeBat = `
@echo off
rem /Zi param is sometimes useful (see fxc /?)
rem reference https://docs.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-sm4-asm

echo:List of files with errors:>_ErrorFileList.txt
echo:>_WarningsList.txt
set /a "_totVert=0"
set /a "_errVert=0"
set /a "_tempsVert=0"
set /a "_instrVert=0"
set /a "_totFrag=0"
set /a "_errFrag=0"
set /a "_tempsFrag=0"
set /a "_instrFrag=0"

set fxcPath="c:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\fxc"

rem compile vertex shaders
for /F %%G in ('dir *VS.hlsl /ON/B') do call :MakeVS4 %%G %1 %2 %3 %4

rem compile fragment shaders
for /F %%G in ('dir *FS.hlsl /ON/B') do call :MakeFS4 %%G %1 %2 %3 %4

call :OutputResults
echo:  See _ErrorFileList.txt for details, see _WarningsList.txt for any warnings or errors
call :OutputResults >>_ErrorFileList.txt
echo:  See _WarningsList.txt for any warnings or errors>>_ErrorFileList.txt

:CleanupALL
set _totVert=
set _errVert=
set _tempsVert=
set _instrVert=
set _totFrag=
set _errFrag=
set _tempsFrag=
set _instrFrag=
set _errCnt=
set _temps=
set _instr=
set _fname=
goto :EOF

:Setup
echo:
if not exist %1.h goto :EOF
del %1.h
goto :EOF

:Error4
set /a "_errCnt=1"
echo:%1>>_ErrorFileList.txt
echo:
echo:        -----  Error compiling %1  -----
echo:
goto :EOF

:Cleanup4
set /a "_errCnt=0"
set _temps=
set _instr=
if not exist %1.h goto :Error4
for /F "tokens=1,2" %%G in ('findstr dcl_temps %1.h') do (if "%%G" EQU "dcl_temps" set _temps=%%H)
for /F "tokens=1,2,3" %%G in ('findstr instruction %1.h') do (set _instr=%%I)
echo:    %_temps% regs  %_instr% instructions
goto :EOF


:makeVS4
set /a "_totVert=_totVert+1"
set _fname=%~n1
call :Setup %_fname%
rem echo:   Compiling /nologo %2 %3 %4 %5 /T vs_4_0 /E main /Fc %_fname%.h %_fname%.hlsl
rem echo:
%fxcPath% /nologo %2 %3 %4 %5 /T vs_4_0 /E main /Fc %_fname%.h %_fname%.hlsl 2>>_WarningsList.txt
rem to get preprocessor output (mainly indenting, and minus any defines) use this also:
rem %fxcPath% /nologo /E main /P listings\\%_fname%.hlsl %_fname%.hlsl
call :Cleanup4 %_fname%
set /a "_errVert=_errVert+_errCnt"
set /a "_tempsVert=_tempsVert+_temps"
set /a "_instrVert=_instrVert+_instr"
goto :EOF

:makeFS4
set /a "_totFrag=_totFrag+1"
set _fname=%~n1
call :Setup %_fname%
rem echo:   Compiling /nologo %2 %3 %4 %5 /T ps_4_0 /E main /Fc %_fname%.h %_fname%.hlsl
rem echo:
%fxcPath% /nologo %2 %3 %4 %5 /T ps_4_0 /E main /Fc %_fname%.h %_fname%.hlsl 2>>_WarningsList.txt
rem to get preprocessor output (mainly indenting, and minus any defines) use this also:
rem %fxcPath% /nologo /E main /P listings\\%_fname%.hlsl %_fname%.hlsl
call :Cleanup4 %_fname%
set /a "_errFrag=_errVert+_errCnt"
set /a "_tempsFrag=_tempsFrag+_temps"
set /a "_instrFrag=_instrFrag+_instr"
goto :EOF

:OutputResults
echo:
echo: --- Compiled %_totVert% vertex shaders with %_errVert% errors  Totals: %_tempsVert% regs  %_instrVert% instructions
echo:
echo: --- Compiled %_totFrag% fragment shaders with %_errfrag% errors  Totals: %_tempsFrag% regs  %_instrFrag% instructions
echo:
goto :EOF
`;

function skipThisShader(entry: DebugShaderFile, usedFlag: string, typeFlag: string, langFlag: string): boolean {
  return ("n" === usedFlag && entry.isUsed) || ("u" === usedFlag && !entry.isUsed) ||
    ("f" === typeFlag && entry.isVS) || ("v" === typeFlag && !entry.isVS) ||
    ("h" === langFlag && entry.isGL) || ("g" === langFlag && !entry.isGL);
}

async function outputShaders(dsf: DebugShaderFile[], usedFlag: string, typeFlag: string, langFlag: string, dir: string) {
  // output shader make file
  let fname = dir + "_makeShade.bat";
  await SVTRpcInterface.getClient().writeExternalFile(fname, makeShadeBat);

  // output output list
  fname = dir + "_OutputList.txt";
  let src = "";
  for (const entry of dsf) {
    if (!skipThisShader(entry, usedFlag, typeFlag, langFlag))
      src = src + entry.filename + "  isUsed: " + entry.isUsed + "\n";
  }
  await SVTRpcInterface.getClient().writeExternalFile(fname, src);

  // output shader files
  for (const entry of dsf) {
    if (skipThisShader(entry, usedFlag, typeFlag, langFlag))
      continue;

    fname = dir + entry.filename;
    src = (entry.isGL ? "" : "// " + entry.filename + "  isUsed: " + entry.isUsed + "\n") + entry.src;
    await SVTRpcInterface.getClient().writeExternalFile(fname, src);
  }

  IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Shaders output to directory " + dir));
}

export class OutputShadersTool extends Tool {
  public static toolId = "OutputShaders";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 2; }

  public run(usedFlag: string, typeFlag: string, langFlag: string, outputDir: string): boolean {
    const dsf = IModelApp.renderSystem.debugControl?.debugShaderFiles;
    if (undefined !== dsf && dsf.length > 0)
      outputShaders(dsf, usedFlag, typeFlag, langFlag, outputDir); // tslint:disable-line:no-floating-promises
    else
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "No shaders (did you define SVT_DEBUG_SHADERS?)"));

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    let usedFlag;
    let typeFlag;
    let langFlag;
    let outputDir;

    for (const arg of args) {
      const parts = arg.split("=");
      if (1 === parts.length) {
        const lowerArgs = parts[0].toLowerCase();
        usedFlag = lowerArgs.includes("u") ? "u" : (lowerArgs.includes("n") ? "n" : "");
        typeFlag = lowerArgs.includes("v") ? "v" : (lowerArgs.includes("f") ? "f" : "");
        langFlag = lowerArgs.includes("g") ? "g" : (lowerArgs.includes("h") ? "h" : "");
      } else if (2 === parts.length && "d" === parts[0].toLowerCase()) {
        outputDir = parts[1];
        if (-1 !== outputDir.indexOf("\\") && !outputDir.endsWith("\\"))
          outputDir += "\\";
        else if (-1 !== outputDir.indexOf("/") && !outputDir.endsWith("/"))
          outputDir += "/";
      }
    }

    return this.run(usedFlag ?? "", typeFlag ?? "", langFlag ?? "", outputDir ?? "d:\\temp\\shaders\\");
  }
}
