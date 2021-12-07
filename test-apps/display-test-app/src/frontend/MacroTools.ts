/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, MessageBoxIconType, MessageBoxType, NotifyMessageDetails, OutputMessagePriority, ParseAndRunResult, Tool } from "@itwin/core-frontend";
import { DtaRpcInterface } from "../common/DtaRpcInterface";

export class MacroTool extends Tool {
  public static override toolId = "Macro";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 1; }

  public override async run(macroFile: string): Promise<boolean> {
    const macroString = await DtaRpcInterface.getClient().readExternalFile(macroFile);
    const re = /\r/g;
    const macroStr2 = macroString.replace (re, "");
    const commands = macroStr2.split ("\n");
    commands.forEach((item, index) => {
      if(item === "") commands.splice(index,1);
    });
    if (commands.length === 0)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "File not found or no content"));
    else {
      for (const cmd of commands) {
        let message: string | undefined;
        try {
          switch (await IModelApp.tools.parseAndRun(cmd)) {
            case ParseAndRunResult.ToolNotFound:
              message = `Cannot find a key-in that matches: ${cmd}`;
              break;
            case ParseAndRunResult.BadArgumentCount:
              message = `Incorrect number of arguments for: ${cmd}`;
              break;
            case ParseAndRunResult.FailedToRun:
              message = `Key-in failed to run: ${cmd}`;
              break;
          }
        } catch (ex) {
          message = `Key-in ${cmd} produced exception: ${ex}`;
        }
        if (undefined !== message)
          await IModelApp.notifications.openMessageBox(MessageBoxType.MediumAlert, message, MessageBoxIconType.Warning);
      }
    }
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const macroFile=args[0];
    return this.run(macroFile);
  }
}
