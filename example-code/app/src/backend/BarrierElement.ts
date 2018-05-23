/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SpatialLocationElement, IModelDb, SpatialCategory } from "@bentley/imodeljs-backend";
import { GeometryStreamProps, GeometryStreamBuilder } from "@bentley/imodeljs-common";
import { Point3d, LineSegment3d } from "@bentley/geometry-core";
import { RobotWorld } from "./RobotWorldSchema";

/**
 * An example of defining a subclass of SpatialLocationElement.
 * Normally, you would start writing a class like this by generating the TypeScript class
 * definition from the ecschema. Then, you would then hand-edit it to add methods.
 * In this example, a "barrier" is represented as a line in the X-Y plane.
 */
export class Barrier extends SpatialLocationElement {
  //  Define the properties added by this subclass
  public length: number = 1.0;                    // The length of the barrier
  public angle: number = 0.0;                     // The orientation angle of the barrier

  // Note: Do not re-define the constructor. You must not interfere with the constructor that is
  // already defined by the base Element class.

  // You can provide handy methods for creating new Robots
  public static generateGeometry(length: number): GeometryStreamProps {
    const builder = new GeometryStreamBuilder();  // I know what graphics represent a robot.
    const p1 = Point3d.createZero();
    const p2 = Point3d.createFrom({ x: length, y: 0.0, z: 0.0 });
    const circle = LineSegment3d.create(p1, p2);
    builder.appendGeometry(circle);
    return builder.geometryStream;
  }

  public static getCategory(iModel: IModelDb): SpatialCategory {
    return RobotWorld.getCategory(iModel, RobotWorld.Class.Barrier);
  }

  // You can write methods to implement business logic that apps can call.
  public someBusinessLogic(): void {
    if ((this.testProperty === "something") && this.isPrivate) {
      // ... do something ...
    }
  }
}
