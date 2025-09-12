/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection } from "@itwin/core-frontend";
import { AngleSweep, Arc3d, LineString3d, Loop, Matrix3d, Path, Point3d } from "@itwin/core-geometry";

class CesiumDecorator implements Decorator {
  private _iModel?: IModelConnection;
  private _xOffset = -220000; // Shift test paths left to avoid overlap

  constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  public decorate(context: DecorateContext): void {
    if (!this._iModel || !context.viewport.view.isSpatialView()) {
      return;
    }
    
    this.createPointDecorations(context);
    this.createLineStringDecorations(context);
    this.createShapeDecorations(context);
    this.createArcDecorations(context);
    this.createPathDecorations(context);
    this.createLoopDecorations(context);
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

  private createPathDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const c = this._iModel.projectExtents.center;

    const z = c.z + 50000;
    const R = 20000;
    

    // First segment: horizontal line from left to right
    const P0 = new Point3d(c.x - 80000 + this._xOffset, c.y - 80000, z);
    const P1 = new Point3d(c.x - 20000 + this._xOffset, c.y - 80000, z);

    // Second segment: vertical line upward to corner point
    const P2 = new Point3d(c.x - 20000 + this._xOffset, c.y - 20000, z);

    // Arc transition: 90-degree arc with radius 20000
    // Using start-middle-end definition to ensure P2 is the arc start point
    // Arc transitions from upward direction to rightward direction
    const arcMid = new Point3d(P2.x + R / Math.SQRT2, P2.y + R / Math.SQRT2, z);
    const arcEnd = new Point3d(P2.x + R, P2.y, z);

    const arc = Arc3d.createCircularStartMiddleEnd(P2, arcMid, arcEnd);
    if (!arc) return;

    // Third segment: continue upward from arc end point
    const P3 = new Point3d(arcEnd.x, arcEnd.y + 40000, z);

    const path1 = Path.create(
      LineString3d.create([P0, P1]),
      LineString3d.create([P1, P2]),
      arc,
      LineString3d.create([arcEnd, P3])
    );

    const builder1 = context.createGraphic({ type: GraphicType.WorldDecoration });
    builder1.setSymbology(ColorDef.from(255, 100, 200), ColorDef.from(255, 100, 200), 3);
    builder1.addPath(path1);
    context.addDecorationFromBuilder(builder1);

    // Second path: zigzag wave pattern
    const zigZag = Path.create(
      LineString3d.create([
        new Point3d(c.x + 50000 + this._xOffset, c.y - 100000, z + 10000),
        new Point3d(c.x + 70000 + this._xOffset, c.y - 80000, z + 10000),
        new Point3d(c.x + 50000 + this._xOffset, c.y - 60000, z + 10000),
        new Point3d(c.x + 70000 + this._xOffset, c.y - 40000, z + 10000),
        new Point3d(c.x + 50000 + this._xOffset, c.y - 20000, z + 10000),
        new Point3d(c.x + 70000 + this._xOffset, c.y, z + 10000)
      ])
    );
    
    const builder2 = context.createGraphic({ type: GraphicType.WorldOverlay });
    builder2.setSymbology(ColorDef.from(100, 255, 100), ColorDef.from(100, 255, 100), 3);
    builder2.addPath(zigZag);
    context.addDecorationFromBuilder(builder2);
  }

  private createLoopDecorations(context: DecorateContext): void {
    if (!this._iModel) return;
    const c = this._iModel.projectExtents.center;

    const z = c.z + 70000;

    // Simple test: Just one triangle
    const trianglePoints = [
      new Point3d(c.x - 60000 + this._xOffset, c.y - 60000, z),
      new Point3d(c.x + 60000 + this._xOffset, c.y - 60000, z),
      new Point3d(c.x + this._xOffset, c.y + 60000, z),
      new Point3d(c.x - 60000 + this._xOffset, c.y - 60000, z)
    ];

    const triangleLoop = Loop.create(LineString3d.create(trianglePoints));

    const builder1 = context.createGraphic({ type: GraphicType.WorldDecoration });
    builder1.setSymbology(ColorDef.from(255, 0, 255), ColorDef.from(255, 0, 255), 2);
    builder1.addLoop(triangleLoop);
    context.addDecorationFromBuilder(builder1);
  }

  public stop(): void {
    IModelApp.viewManager.dropDecorator(this);
  }
}

export { CesiumDecorator };
