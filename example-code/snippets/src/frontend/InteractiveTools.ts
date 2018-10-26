/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { PrimitiveTool, IModelApp, AccuDrawHintBuilder, BeButtonEvent, DynamicsContext, EventHandled, Viewport } from "@bentley/imodeljs-frontend";
import { Point3d, Vector3d } from "@bentley/geometry-core";
import { GraphicType } from "@bentley/imodeljs-frontend/lib/rendering";
import { ColorDef } from "@bentley/imodeljs-common";

export class SamplePrimitiveTool extends PrimitiveTool {
  public static toolId = "Sample.Run";

  // __PUBLISH_EXTRACT_START__ PrimitiveTool_SelectedViewport
  public onSelectedViewportChanged(_previous: Viewport | undefined, current: Viewport | undefined): void {
    if (this.isCompatibleViewport(current, true))
      return;
    this.onRestartTool();
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ PrimitiveTool_Restart
  public onRestartTool(): void {
    const tool = new SamplePrimitiveTool();
    if (!tool.run())
      this.exitTool();
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ PrimitiveTool_PostInstall
  public onPostInstall() {
    super.onPostInstall();
    IModelApp.accuSnap.enableSnap(true);
  }
  // __PUBLISH_EXTRACT_END__

  // __PUBLISH_EXTRACT_START__ PrimitiveTool_Run
  public run(): boolean {
    const { toolAdmin, viewManager } = IModelApp;
    if (!this.isCompatibleViewport(viewManager.selectedView, false) || !toolAdmin.onInstallTool(this))
      return false;

    toolAdmin.startPrimitiveTool(this);
    toolAdmin.onPostInstallTool(this);
    return true;
  }
  // __PUBLISH_EXTRACT_END__
}

export class CreateByPointsTool extends PrimitiveTool {
  public static toolId = "Create.ByPoints";
  public readonly points: Point3d[] = [];

  // __PUBLISH_EXTRACT_START__ PrimitiveTool_PointsTool
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }

  public setupAndPromptForNextAction(): void {
    IModelApp.accuSnap.enableSnap(true);
    // NEEDSWORK: Prompt...

    if (0 === this.points.length)
      return;

    const hints = new AccuDrawHintBuilder();
    hints.enableSmartRotation = true;

    if (this.points.length > 1 && !(this.points[this.points.length - 1].isAlmostEqual(this.points[this.points.length - 2])))
      hints.setXAxis(Vector3d.createStartEnd(this.points[this.points.length - 2], this.points[this.points.length - 1])); // Rotate AccuDraw to last segment...

    hints.setOrigin(this.points[this.points.length - 1]);
    hints.sendHints();
  }
  // __PUBLISH_EXTRACT_END__

  public onDynamicFrame(ev: BeButtonEvent, context: DynamicsContext): void {
    if (this.points.length < 1)
      return;

    const builder = context.createGraphicBuilder(GraphicType.Scene);

    builder.setSymbology(context.viewport.getContrastToBackgroundColor(), ColorDef.black, 1);
    builder.addLineString([this.points[this.points.length - 1], ev.point]); // Only draw current segment in dynamics, accepted segments are drawn as pickable decorations...

    context.addGraphic(builder.finish());
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    this.points.push(ev.point.clone());
    this.setupAndPromptForNextAction();

    if (!this.isDynamicsStarted)
      this.beginDynamics();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    this.onReinitialize();
    return EventHandled.No;
  }

  public onUndoPreviousStep(): boolean {
    if (0 === this.points.length)
      return false;

    this.points.pop();
    if (0 === this.points.length)
      this.onReinitialize();
    else
      this.setupAndPromptForNextAction();
    return true;
  }

  public onRestartTool(): void {
    const tool = new CreateByPointsTool();
    if (!tool.run())
      this.exitTool();
  }
}
