/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp, PrimitiveTool,
  BeButtonEvent, EventHandled,
} from "@bentley/imodeljs-frontend";

import { Point3d } from "@bentley/geometry-core";

export class Tool2 extends PrimitiveTool {
  public static toolId = "Tool2";
  public readonly points: Point3d[] = [];

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.notifications.outputPromptByKey("SampleApp:tools.Tool2.Prompts.GetPoint");
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
    const tool = new Tool2();
    if (!tool.run())
      this.exitTool();
  }
}
