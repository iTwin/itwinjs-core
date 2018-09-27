/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ RpcInterface.definition
import { RpcInterface, IModelToken, RpcManager } from "@bentley/imodeljs-common";
import { Id64Props } from "@bentley/bentleyjs-core";

// The RPC query interface that may be exposed by the AnalysisEngine.
export abstract class AnalysisReadRpcInterface extends RpcInterface {
  public static version = "1.0.0";  // The API version of the interface
  public static types = () => [IModelToken]; // Types used
  public static getClient() { return RpcManager.getClientForInterface(this); }
}
// __PUBLISH_EXTRACT_END__

import { Point3d, Angle, Polyface } from "@bentley/geometry-core";

// The RPC write interface that may be exposed by the AnalysisEngine.
export abstract class AnalysisWriteRpcInterface extends RpcInterface {
  public static version = "1.0.0"; // The API version of the interface
  public static types = () => [IModelToken, Polyface, Point3d, Angle]; // Types used
  public static getClient() { return RpcManager.getClientForInterface(this); }
  public insertMesh(_iModelToken: IModelToken, _modelId: Id64Props, _name: string, _location: Point3d, _polyface: Polyface): Promise<Id64Props> { return this.forward.apply(this, arguments); }
}
