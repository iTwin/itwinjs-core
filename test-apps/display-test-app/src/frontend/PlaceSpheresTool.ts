/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, IModelApp, PrimitiveTool } from "@itwin/core-frontend";
import { Point3d, Sphere } from "@itwin/core-geometry";

function getColor(index: number): ColorDef {
  const colors = [ColorDef.red, ColorDef.blue, ColorDef.green, ColorDef.white, ColorDef.black];
  return colors[index % colors.length];
}

export class PlaceSpheresTool extends PrimitiveTool {
  private readonly _points: Point3d[] = [];
  private _radius = 10;
  
  public static override toolId = "DtaPlaceSpheres";

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    IModelApp.accuSnap.enableSnap(true);
  }

  public override async onCleanup() {
    // ###TODO
  }

  public override async onDataButtonDown(ev: BeButtonEvent) {
    this._points.push(ev.point);
    ev.viewport?.invalidateDecorations();
    return EventHandled.No;
  }

  public override async onResetButtonUp(ev: BeButtonEvent) {
    this._points.pop();
    ev.viewport?.invalidateDecorations();
    return EventHandled.No;
  }

  public override decorate(context: DecorateContext) {
    const builder = context.createGraphicBuilder(GraphicType.Scene);
    for (let i = 0; i < this._points.length; i++) {
      const sphere = Sphere.createCenterRadius(this._points[i], this._radius);
      builder.setSymbology(getColor(i), getColor(i).withTransparency(0x7f), 1);
      builder.addSolidPrimitive(sphere);
    }

    context.addDecorationFromBuilder(builder);
  }

  public override decorateSuspended(context: DecorateContext) {
    this.decorate(context);
  }

  public override async onRestartTool() {
    const tool = new PlaceSpheresTool();
    if (!await tool.run()) {
      await this.exitTool();
    }
  }
}
