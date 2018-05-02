/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Element.subclass
import { SpatialLocationElement, IModelDb, PhysicalModel } from "@bentley/imodeljs-backend";
import { GeometricElement3dProps, GeometryStreamBuilder } from "@bentley/imodeljs-common";
import { Point3d, Arc3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { RobotWorldSchema } from "./RobotWorldSchema";

/**
 * An example of defining a subclass of SpatialLocationElement.
 * Normally, you would start writing a class like this by generating the TypeScript class
 * definition from the ecschema. Then, you would then hand-edit it to add methods.
 * In this example, a "robot" is represented as a circle in the X-Y plane.
 */
export class Robot extends SpatialLocationElement {
  //  Define the properties added by this subclass
  public radius: number = 0.1;                     // The girth of the robot

  // Note: Do not re-define the constructor. You must not interfere with the constructor that is
  // already defined by the base Element class.

  // Define a factory method to make it easy for backend code to create new instances.
  public static create(model: PhysicalModel, location: Point3d, radius: number = 0.1) {
    const iModel: IModelDb = model.iModel;

    const builder = new GeometryStreamBuilder();  // I know what graphics represent a robot.
    const circle = Arc3d.createXY(Point3d.createZero(), radius);
    builder.appendGeometryQuery(circle);

    const props: GeometricElement3dProps = {      // I know what class and category to use.
      model,
      classFullName: RobotWorldSchema.Class.Robot,
      category: RobotWorldSchema.getCategory(iModel, RobotWorldSchema.Class.Robot).id,
      geom: builder.geometryStream,
      placement: { origin: location, angles: new YawPitchRollAngles()},
    };

    const r = new Robot(props, iModel);           // construct the Robot instance
    r.radius = radius;

    return r;
  }

  // You can write methods to implement business logic that apps can call.
  public someBusinessLogic(): void {
    if ((this.testProperty === "something") && this.isPrivate) {
      // ... do something ...
    }
  }
}
// __PUBLISH_EXTRACT_END__
