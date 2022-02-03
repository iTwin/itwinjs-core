/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import type { IModelRpcProps} from "@itwin/core-common";
import { RpcInterface, RpcManager } from "@itwin/core-common";
import type { Id64String } from "@itwin/core-bentley";

// The RPC query interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcInterface extends RpcInterface {
  public static readonly interfaceName = "RobotWorldReadRpcInterface"; // The immutable name of the interface
  public static interfaceVersion = "1.0.0";  // The API version of the interface
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public async countRobotsInArray(_iModelToken: IModelRpcProps, _elemIds: Id64String[]): Promise<number> { return this.forward(arguments); }
  public async countRobots(_iModelToken: IModelRpcProps): Promise<number> { return this.forward(arguments); }
  public async queryObstaclesHitByRobot(_iModelToken: IModelRpcProps, _rid: Id64String): Promise<Id64String[]> { return this.forward(arguments); }
}
// __PUBLISH_EXTRACT_END__

import type { AngleProps, XYZProps } from "@itwin/core-geometry";

// The RPC write interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteRpcInterface extends RpcInterface {
  public static readonly interfaceName = "RobotWorldWriteRpcInterface"; // The immutable name of the interface
  public static interfaceVersion = "1.0.0"; // The API version of the interface
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public async insertRobot(_iModelToken: IModelRpcProps, _modelId: Id64String, _name: string, _location: XYZProps): Promise<Id64String> { return this.forward(arguments); }
  public async moveRobot(_iModelToken: IModelRpcProps, _id: Id64String, _location: XYZProps): Promise<void> { return this.forward(arguments); }
  public async insertBarrier(_iModelToken: IModelRpcProps, _modelId: Id64String, _location: XYZProps, _angle: AngleProps, _length: number): Promise<Id64String> { return this.forward(arguments); }
}
