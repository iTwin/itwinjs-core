/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection } from "@itwin/core-frontend";
import { AngleSweep, Arc3d, Matrix3d, Point3d } from "@itwin/core-geometry";
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
      this.createShapeDecorations(context);
      this.createArcDecorations(context);
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
        color: ColorDef.from(255, 0, 0),
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
        color: ColorDef.from(255, 165, 0),
      }
    ];
    
    lines.forEach((line) => {
      const builder = context.createGraphic({ type: line.type });
      builder.setSymbology(line.color, line.color, 2);
      builder.addLineString(line.points);
      context.addDecorationFromBuilder(builder);
    });
  }

  private createShapeDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;
    
    const shapes = [
      {
        points: [
          new Point3d(center.x - 80000, center.y - 80000, center.z + 15000),
          new Point3d(center.x + 80000, center.y - 80000, center.z + 15000),
          new Point3d(center.x, center.y + 80000, center.z + 15000),
          new Point3d(center.x - 80000, center.y - 80000, center.z + 15000),
        ],
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(0, 255, 0),
      },
      {
        points: [
          new Point3d(center.x - 60000, center.y + 40000, center.z + 25000),
          new Point3d(center.x - 20000, center.y + 40000, center.z + 25000),
          new Point3d(center.x - 20000, center.y + 80000, center.z + 25000),
          new Point3d(center.x - 60000, center.y + 80000, center.z + 25000),
          new Point3d(center.x - 60000, center.y + 40000, center.z + 25000),
        ],
        type: GraphicType.WorldOverlay,
        color: ColorDef.from(255, 0, 255),
      }
    ];
    
    shapes.forEach((shape) => {
      const builder = context.createGraphic({ type: shape.type });
      builder.setSymbology(shape.color, shape.color, 3);
      builder.addShape(shape.points);
      context.addDecorationFromBuilder(builder);
    });
  }

  private createArcDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const center = this._iModel.projectExtents.center;
    
    const arcs = [
      {
        arc: Arc3d.createScaledXYColumns(
          new Point3d(center.x - 100000, center.y - 100000, center.z + 35000),
          Matrix3d.createIdentity(),
          40000,
          40000,
          AngleSweep.createStartSweepRadians(0, Math.PI)
        ),
        isEllipse: false,
        filled: false,
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 255, 0),
      },
      {
        arc: Arc3d.createScaledXYColumns(
          new Point3d(center.x + 100000, center.y + 100000, center.z + 40000),
          Matrix3d.createIdentity(),
          30000,
          50000,
          AngleSweep.createStartSweepRadians(0, Math.PI * 2)
        ),
        isEllipse: true,
        filled: true,
        type: GraphicType.WorldOverlay,
        color: ColorDef.from(0, 255, 255),
      },
      {
        arc: Arc3d.createScaledXYColumns(
          new Point3d(center.x, center.y - 200000, center.z + 45000),
          Matrix3d.createIdentity(),
          60000,
          30000,
          AngleSweep.createStartSweepRadians(Math.PI / 4, Math.PI * 1.5)
        ),
        isEllipse: false,
        filled: false,
        type: GraphicType.WorldDecoration,
        color: ColorDef.from(255, 100, 100),
      }
    ];
    
    arcs.forEach((arcDef) => {
      const builder = context.createGraphic({ type: arcDef.type });
      builder.setSymbology(arcDef.color, arcDef.color, 2);
      builder.addArc(arcDef.arc, arcDef.isEllipse, arcDef.filled);
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
  }
}

export { CesiumDecorator };