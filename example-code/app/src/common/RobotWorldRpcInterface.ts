/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import { RpcInterface, IModelToken, RpcManager } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";

// The RPC query interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcInterface extends RpcInterface {
  public static version = "1.0.0";  // The API version of the interface
  public static types = () => [IModelToken]; // Types used
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public async countRobotsInArray(_iModelToken: IModelToken, _elemIds: Id64String[]): Promise<number> { return this.forward(arguments); }
  public async countRobots(_iModelToken: IModelToken): Promise<number> { return this.forward(arguments); }
  public async queryObstaclesHitByRobot(_iModelToken: IModelToken, _rid: Id64String): Promise<Id64String[]> { return this.forward(arguments); }
}
// __PUBLISH_EXTRACT_END__

import { Point3d, Angle } from "@bentley/geometry-core";

// The RPC write interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteRpcInterface extends RpcInterface {
  public static version = "1.0.0"; // The API version of the interface
  public static types = () => [IModelToken, Point3d, Angle]; // Types used
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public async insertRobot(_iModelToken: IModelToken, _modelId: Id64String, _name: string, _location: Point3d): Promise<Id64String> { return this.forward(arguments); }
  public async moveRobot(_iModelToken: IModelToken, _id: Id64String, _location: Point3d): Promise<void> { return this.forward(arguments); }
  public async insertBarrier(_iModelToken: IModelToken, _modelId: Id64String, _location: Point3d, _angle: Angle, _length: number): Promise<Id64String> { return this.forward(arguments); }
}
