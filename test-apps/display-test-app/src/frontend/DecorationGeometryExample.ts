/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Box, Cone, Point3d, Range3d, Sphere, Transform } from "@bentley/geometry-core";
import { ColorDef, RenderMode } from "@bentley/imodeljs-common";
import { DecorateContext, GraphicBranch, GraphicBuilder, GraphicType, IModelApp, IModelConnection, StandardViewId, Viewport } from "@bentley/imodeljs-frontend";
import { Viewer } from "./Viewer";

class GeometryDecorator {
  public readonly useCachedDecorations = true;
  private readonly _iModel: IModelConnection;
  private readonly _decorators = new Map<string, (builder: GraphicBuilder) => void>();

  public constructor(viewport: Viewport) {
    this._iModel = viewport.iModel;

    this.addSphere(0);
    this.addBox(2);
    this.addCone(4);
    this.addShape(6);
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport.iModel !== this._iModel)
      return;

    const colors = [ColorDef.blue, ColorDef.red, ColorDef.green];
    let colorIndex = 0;
    const branch = new GraphicBranch();
    for (const [key, value] of this._decorators) {
      const builder = context.createGraphicBuilder(GraphicType.Scene, undefined, key);

      const color = colors[colorIndex++];
      if (colorIndex >= colors.length)
        colorIndex = 0;

      builder.setSymbology(color, color, 1);
      value(builder);
      branch.add(builder.finish());
    }

    const graphic = context.createGraphicBranch(branch, Transform.createIdentity());
    context.addDecoration(GraphicType.Scene, graphic);
  }

  private addShape(ox: number): void {
    const points = [
      new Point3d(ox, 0, 0), new Point3d(ox + 1, 0, 0), new Point3d(ox + 1, 1, 1), new Point3d(ox, 1, 1), new Point3d(ox, 0, 0),
    ];
    this._decorators.set(this._iModel.transientIds.next, (builder) => builder.addShape(points));
  }

  private addDecorator(decorate: (builder: GraphicBuilder) => void): void {
    this._decorators.set(this._iModel.transientIds.next, decorate);
  }

  private addBox(cx: number): void {
  const box = Box.createRange(new Range3d(cx, 0, 0, cx + 1, 1, 1), true);
  if (box)
    this.addDecorator((builder) => builder.addSolidPrimitive(box));
  }

  private addSphere(cx: number): void {
    const sphere = Sphere.createCenterRadius(new Point3d(cx + 0.5, 0.5, 0.5), 0.5);
    this.addDecorator((builder) => builder.addSolidPrimitive(sphere));
  }

  private addCone(cx: number): void {
    const cone = Cone.createAxisPoints(new Point3d(cx, 0, 0), new Point3d(cx, 0, 1), 0.5, 0.25, true);
    if (cone)
      this.addDecorator((builder) => builder.addSolidPrimitive(cone));
  }
}

export function openDecorationGeometryExample(viewer: Viewer): void {
  IModelApp.viewManager.addDecorator(new GeometryDecorator(viewer.viewport));

  assert(viewer.viewport.view.is3d());
  viewer.viewport.setStandardRotation(StandardViewId.Iso);
  viewer.viewport.turnCameraOn();
  viewer.viewport.zoomToVolume(viewer.viewport.iModel.projectExtents);

  const viewFlags = viewer.viewport.viewFlags.clone();
  viewFlags.renderMode = RenderMode.SmoothShade;
  viewFlags.lighting = true;
  viewFlags.visibleEdges = true;
  viewFlags.whiteOnWhiteReversal = false;
  viewFlags.backgroundMap = true;
  viewer.viewport.viewFlags = viewFlags;

  viewer.viewport.view.getDisplayStyle3d().settings.environment = {
    sky: {
      display: true,
      twoColor: true,
      nadirColor: 0xdfefff,
      zenithColor: 0xffefdf,
    },
  };
}
