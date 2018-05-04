/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { SpatialLocationElement, IModelDb, PhysicalModel } from "@bentley/imodeljs-backend";
import { GeometricElement3dProps, GeometryStreamBuilder } from "@bentley/imodeljs-common";
import { Point3d, LineSegment3d, Angle, YawPitchRollAngles } from "@bentley/geometry-core";
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

  // Define a factory method to make it easy for backend code to create new instances.
  public static create(model: PhysicalModel, location: Point3d, angle: Angle, length: number) {
    const iModel: IModelDb = model.iModel;

    const builder = new GeometryStreamBuilder();  // I know what graphics represent a robot.
    const p1 = Point3d.createZero();
    const p2 = Point3d.createFrom({x: length, y: 0.0, z: 0.0});
    const circle = LineSegment3d.create(p1, p2);
    builder.appendGeometryQuery(circle);

    const props: GeometricElement3dProps = {      // I know what class and category to use.
      model: model.id,
      classFullName: RobotWorld.Class.Barrier,
      category: RobotWorld.getCategory(iModel, RobotWorld.Class.Barrier).id,
      geom: builder.geometryStream,
      placement: { origin: location, angles: new YawPitchRollAngles(angle, Angle.zero(), Angle.zero()) },
    };

    const r = new Barrier(props, iModel);           // construct the Barrier instance
    r.length = length;
    r.angle = angle.degrees;

    return r;
  }

  // You can write methods to implement business logic that apps can call.
  public someBusinessLogic(): void {
    if ((this.testProperty === "something") && this.isPrivate) {
      // ... do something ...
    }
  }
}
