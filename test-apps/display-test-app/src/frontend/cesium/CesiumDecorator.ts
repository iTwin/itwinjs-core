/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
// import { LineString3d, Path } from "@itwin/core-geometry";

class CesiumDecorator implements Decorator {
  private _iModel?: IModelConnection;

  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  public decorate(context: DecorateContext): void {
    if (!this._iModel || !context.viewport.view.isSpatialView()) {
      return;
    }
    
    try {
      this.createPointDecorations(context);
      this.createLineStringDecorations(context);
    } catch (error) {
      console.error('Decoration creation failed:', error);
    }
  }

  private createPointDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;
    
    const points = [
      new Point3d(center.x - 50000, center.y, center.z + 10000),
      new Point3d(center.x, center.y + 50000, center.z + 20000),
      new Point3d(center.x + 50000, center.y - 50000, center.z + 30000),
    ];
    
    points.forEach((point) => {
      const builder = context.createGraphic({ type: GraphicType.WorldDecoration });
      builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
      builder.addPointString([point]);
      context.addDecorationFromBuilder(builder);
    });
  }

  private createLineStringDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;
    
    // Create test lines with different GraphicTypes
    const lines = [
      {
        points: [
          new Point3d(center.x - 120000, center.y - 120000, center.z + 5000),
          new Point3d(center.x + 120000, center.y - 120000, center.z + 5000),
          new Point3d(center.x + 120000, center.y + 120000, center.z + 5000),
          new Point3d(center.x - 120000, center.y + 120000, center.z + 5000),
          new Point3d(center.x - 120000, center.y - 120000, center.z + 5000),
        ],
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 0, 0), // Red
      },
      {
        points: [
          new Point3d(center.x - 150000, center.y, center.z + 19000),
          new Point3d(center.x, center.y + 150000, center.z + 19000),
          new Point3d(center.x + 150000, center.y, center.z + 19000),
          new Point3d(center.x, center.y - 150000, center.z + 19000),
          new Point3d(center.x - 150000, center.y, center.z + 19000),
        ],
        type: GraphicType.WorldOverlay,
        color: ColorDef.from(255, 165, 0), // Orange
      }
    ];
    
    lines.forEach((line) => {
      const builder = context.createGraphic({ type: line.type });
      builder.setSymbology(line.color, line.color, 2);
      builder.addLineString(line.points);
      context.addDecorationFromBuilder(builder);
    });
  }

  public static start(iModel: IModelConnection): CesiumDecorator {
    const decorator = new CesiumDecorator(iModel);
    IModelApp.viewManager.addDecorator(decorator);
    return decorator;
  }

  public stop(): void {
    IModelApp.viewManager.dropDecorator(this);
    console.log('CesiumDecorator stopped');
  }
}

export { CesiumDecorator };