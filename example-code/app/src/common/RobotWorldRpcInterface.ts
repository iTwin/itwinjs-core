/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import { RpcInterface, IModelToken } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";
import { Point3d, Angle } from "@bentley/geometry-core";

// The "write" RPC interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldWriteRpcInterface extends RpcInterface {
  public static version = "1.0.0"; // The API version of the interface

  /** The types that are used by the interfaces and must be marshalled. */
  public static types = () => [IModelToken, Id64, Point3d];

  // The interface operations:
  public abstract insertRobot(_iModelToken: IModelToken, _modelId: Id64, _name: string, _location: Point3d): Promise<Id64>;
  public abstract moveRobot(_iModelToken: IModelToken, _id: Id64, _location: Point3d): Promise<void>;
  public abstract fuseRobots(_iModelToken: IModelToken, _r1: Id64, _r2: Id64): Promise<void>;
  public abstract insertBarrier(_iModelToken: IModelToken, _modelId: Id64, _location: Point3d, _angle: Angle, _length: number): Promise<Id64>;
}

// The "read" RPC interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcInterface extends RpcInterface {
  public static version = "1.0.0";  // The API version of the interface

  /** The types that can be marshaled by the interface. */
  public static types = () => [IModelToken, Id64];

  // The interface operations:
  public abstract countRobotsInArray(_iModelToken: IModelToken, _elemIds: Id64[]): Promise<number>;
  public abstract countRobots(_iModelToken: IModelToken): Promise<number>;
  public abstract queryObstaclesHitByRobot(_iModelToken: IModelToken, _rid: Id64): Promise<Id64[]>;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ RpcInterface.client-stub

export abstract class RobotWorldWriteRpcClient extends RpcInterface implements RobotWorldWriteRpcInterface {
  public insertRobot(_iModelToken: IModelToken, _modelId: Id64, _name: string, _location: Point3d): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }

  public moveRobot(_iModelToken: IModelToken, _id: Id64, _location: Point3d): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public fuseRobots(_iModelToken: IModelToken, _r1: Id64, _r2: Id64): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public insertBarrier(_iModelToken: IModelToken, _modelId: Id64, _location: Point3d, _angle: Angle, _length: number): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }
}

// The "read" RPC interface that may be exposed by the RobotWorldEngine.
export abstract class RobotWorldReadRpcClient extends RpcInterface implements RobotWorldReadRpcInterface {
  public countRobotsInArray(_iModelToken: IModelToken, _elemIds: Id64[]): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public countRobots(_iModelToken: IModelToken): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public queryObstaclesHitByRobot(_iModelToken: IModelToken, _rid: Id64): Promise<Id64[]> {
    return this.forward.apply(this, arguments);
  }
}
// __PUBLISH_EXTRACT_END__
