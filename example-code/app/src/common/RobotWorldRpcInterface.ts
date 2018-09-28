/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import { RpcInterface, IModelToken, RpcManager } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";

// The RPC query interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcInterface extends RpcInterface {
  public static version = "1.0.0";  // The API version of the interface
  public static types = () => [IModelToken]; // Types used
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public countRobotsInArray(_iModelToken: IModelToken, _elemIds: Id64String[]): Promise<number> { return this.forward.apply(this, arguments); }
  public countRobots(_iModelToken: IModelToken): Promise<number> { return this.forward.apply(this, arguments); }
  public queryObstaclesHitByRobot(_iModelToken: IModelToken, _rid: Id64String): Promise<Id64String[]> { return this.forward.apply(this, arguments); }
}
// __PUBLISH_EXTRACT_END__

import { Point3d, Angle } from "@bentley/geometry-core";

// The RPC write interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteRpcInterface extends RpcInterface {
  public static version = "1.0.0"; // The API version of the interface
  public static types = () => [IModelToken, Point3d, Angle]; // Types used
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public insertRobot(_iModelToken: IModelToken, _modelId: Id64String, _name: string, _location: Point3d): Promise<Id64String> { return this.forward.apply(this, arguments); }
  public moveRobot(_iModelToken: IModelToken, _id: Id64String, _location: Point3d): Promise<void> { return this.forward.apply(this, arguments); }
  public fuseRobots(_iModelToken: IModelToken, _r1: Id64String, _r2: Id64String): Promise<void> { return this.forward.apply(this, arguments); }
  public insertBarrier(_iModelToken: IModelToken, _modelId: Id64String, _location: Point3d, _angle: Angle, _length: number): Promise<Id64String> { return this.forward.apply(this, arguments); }
}
