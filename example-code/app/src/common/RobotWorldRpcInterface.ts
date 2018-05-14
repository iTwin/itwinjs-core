/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import { RpcInterface, IModelToken } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { Point3d, Angle } from "@bentley/geometry-core";

// RobotWorldEngine RPC Interface Definitions
// These classes are common to RobotWorldEngine and its clients.
// If these are app-specific interfaces, then they would be defined in a directory
// in the app's source tree that is common to both frontend and backend.
// If these are service interfaces, then they would be defined in an RPC interface
// definition package that is accessible by both the
// service implementation and the clients that use the service.

// The "write" RPC interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteRpcInterface extends RpcInterface {
  public static version = "1.0.0"; // The API version of the interface

  /** The types that are used by the interfaces and must be marshalled. */
  public static types = () => [IModelToken, Id64, Point3d];

  // The interface operations:
  public async insertRobot(_iModelToken: IModelToken, _modelId: Id64, _name: string, _location: Point3d): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }

  public async moveRobot(_iModelToken: IModelToken, _id: Id64, _location: Point3d): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public async fuseRobots(_iModelToken: IModelToken, _r1: Id64, _r2: Id64): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public async insertBarrier(_iModelToken: IModelToken, _modelId: Id64, _location: Point3d, _angle: Angle, _length: number): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }
}

// The "read" RPC interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcInterface extends RpcInterface {
  public static version = "1.0.0";  // The API version of the interface

  /** The types that can be marshaled by the interface. */
  public static types = () => [IModelToken, Id64];

  // The interface operations:
  public async countRobotsInArray(_iModelToken: IModelToken, _elemIds: Id64[]): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async countRobots(_iModelToken: IModelToken): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async queryObstaclesHitByRobot(_iModelToken: IModelToken, _rid: Id64): Promise<Id64[]> {
    return this.forward.apply(this, arguments);
  }

}
// __PUBLISH_EXTRACT_END__
