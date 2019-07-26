/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp, PrimitiveTool,
  BeButtonEvent, EventHandled,
  ToolAssistance, ToolAssistanceImage,
} from "@bentley/imodeljs-frontend";

import { Point3d } from "@bentley/geometry-core";

export class Tool1 extends PrimitiveTool {
  public static toolId = "Tool1";
  public static iconSpec = "icon-placeholder";
  public readonly points: Point3d[] = [];

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    // IModelApp.notifications.outputPromptByKey("SampleApp:tools.Tool1.Prompts.GetPoint");

    const mainInstruction = ToolAssistance.createInstruction(ToolAssistanceImage.CursorClick, IModelApp.i18n.translate("SampleApp:tools.Tool2.Prompts.GetPoint"));

    const instruction1 = ToolAssistance.createInstruction(ToolAssistanceImage.CursorClick, "Click on something", true);
    const instruction2 = ToolAssistance.createKeyboardInstruction(ToolAssistance.createKeyboardInfo(["A"]), "Press a key");
    const instruction3 = ToolAssistance.createKeyboardInstruction(ToolAssistance.createKeyboardInfo(["A", "B"]), "Press one of two keys", true);
    const instruction4 = ToolAssistance.createKeyboardInstruction(ToolAssistance.createKeyboardInfo(["W"], ["A", "S", "D"]), "Press one of four keys");
    const instruction5 = ToolAssistance.createKeyboardInstruction(ToolAssistance.shiftKeyboardInfo, "Press the Shift key", true);
    const instruction6 = ToolAssistance.createKeyboardInstruction(ToolAssistance.ctrlKeyboardInfo, "Press the Ctrl key");
    const instruction7 = ToolAssistance.createKeyboardInstruction(ToolAssistance.altKeyboardInfo, "Press the Alt key");

    const section1 = ToolAssistance.createSection([instruction1, instruction2, instruction3, instruction4, instruction5, instruction6, instruction7], ToolAssistance.inputsLabel);

    const instruction21 = ToolAssistance.createInstruction(ToolAssistanceImage.AcceptPoint, "Accept result");
    const instruction22 = ToolAssistance.createInstruction(ToolAssistanceImage.MouseWheel, "Use mouse wheel");
    const instruction23 = ToolAssistance.createInstruction(ToolAssistanceImage.LeftClick, "Left click");
    const instruction24 = ToolAssistance.createInstruction(ToolAssistanceImage.RightClick, "Right click");
    const section2 = ToolAssistance.createSection([instruction21, instruction22, instruction23, instruction24], "More Inputs");

    const instructions = ToolAssistance.createInstructions(mainInstruction, [section1, section2]);

    IModelApp.notifications.setToolAssistance(instructions);
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();
    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    IModelApp.toolAdmin.startDefaultTool();
    return EventHandled.No;
  }

  public onRestartTool(): void {
    const tool = new Tool1();
    if (!tool.run())
      this.exitTool();
  }
}
