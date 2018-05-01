/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Gateway.definition
import { Gateway, IModelToken } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";

// RobotWorldEngine Gateway Definitions
// These classes are common to RobotWorldEngine and its clients.
// If these are app-specific gateways, then they would be defined in a directory
// in the app's source tree that is common to both frontend and backend.
// If these are service gateways, then they would be defined in a gateway
// definition package that is accessible by both the
// service implementation and the clients that use the service.

// The "write" gateway that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteGateway extends Gateway {
  public static version = "1.0.0"; // The API version of the gateway

  /** The types that used by the gateway and must be marshalled. */
  public static types = () => [IModelToken, Id64, Point3d];

  // The gateway operations:
  public async insertRobot(_iModelToken: IModelToken, _name: string, _location: Point3d): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }

  public async moveRobot(_iModelToken: IModelToken, _id: Id64, _location: Point3d): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public async fuseRobots(_iModelToken: IModelToken, _r1: Id64, _r2: Id64, _location: Point3d): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public async insertObstacle(_iModelToken: IModelToken, _location: Point3d): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }
}

// The "read" gateway that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadGateway extends Gateway {
  public static version = "1.0.0";  // The API version of the gateway

  /** The types that can be marshaled by the gateway. */
  public static types = () => [IModelToken, Id64];

  // The gateway operations:
  public async countRobotsInArray(_iModelToken: IModelToken, _elemIds: Id64[]): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async countRobots(_iModelToken: IModelToken): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async queryRobotsHittingObstacles(_iModelToken: IModelToken): Promise<Id64[]> {
    return this.forward.apply(this, arguments);
  }

}
// __PUBLISH_EXTRACT_END__
