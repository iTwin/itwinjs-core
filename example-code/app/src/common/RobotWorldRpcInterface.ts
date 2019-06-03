/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import { RpcInterface, IModelTokenProps, RpcManager } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";

// The RPC query interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcInterface extends RpcInterface {
  public static readonly interfaceName = "RobotWorldReadRpcInterface"; // The immutable name of the interface
  public static interfaceVersion = "1.0.0";  // The API version of the interface
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public async countRobotsInArray(_iModelToken: IModelTokenProps, _elemIds: Id64String[]): Promise<number> { return this.forward(arguments); }
  public async countRobots(_iModelToken: IModelTokenProps): Promise<number> { return this.forward(arguments); }
  public async queryObstaclesHitByRobot(_iModelToken: IModelTokenProps, _rid: Id64String): Promise<Id64String[]> { return this.forward(arguments); }
}
// __PUBLISH_EXTRACT_END__

import { XYZProps, AngleProps } from "@bentley/geometry-core";

// The RPC write interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteRpcInterface extends RpcInterface {
  public static readonly interfaceName = "RobotWorldWriteRpcInterface"; // The immutable name of the interface
  public static interfaceVersion = "1.0.0"; // The API version of the interface
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public async insertRobot(_iModelToken: IModelTokenProps, _modelId: Id64String, _name: string, _location: XYZProps): Promise<Id64String> { return this.forward(arguments); }
  public async moveRobot(_iModelToken: IModelTokenProps, _id: Id64String, _location: XYZProps): Promise<void> { return this.forward(arguments); }
  public async insertBarrier(_iModelToken: IModelTokenProps, _modelId: Id64String, _location: XYZProps, _angle: AngleProps, _length: number): Promise<Id64String> { return this.forward(arguments); }
}
