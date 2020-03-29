/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { IModelRpcProps } from "../IModel";
import { Id64Array, GuidString } from "@bentley/bentleyjs-core";
import { GeometricElement3dProps } from "../ElementProps";
import { TransformProps, YawPitchRollAngles, Point3d } from "@bentley/geometry-core";

/** The RPC interface for editing Spatial and other 3D elements and Models in an iModel.
 * All operations require read+write access.
 * @alpha
 */
export abstract class Editor3dRpcInterface extends RpcInterface {
  /** Returns the client instance for the frontend. */
  public static getClient(): Editor3dRpcInterface { return RpcManager.getClientForInterface(Editor3dRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "Editor3dRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "0.0.1";

  /*===========================================================================================
      NOTE: Any add/remove/change to the methods below requires an update of the interface version.
      NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async start(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async end(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async writeAllChangesToBriefcase(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async startModifyingElements(_tokenProps: IModelRpcProps, _editorId: GuidString, _elementIds: Id64Array): Promise<void> { return this.forward(arguments); }
  public async createElement(_tokenProps: IModelRpcProps, _editorId: GuidString, _props: GeometricElement3dProps, _origin?: Point3d, _angles?: YawPitchRollAngles, _geometry?: any): Promise<void> { return this.forward(arguments); }
  public async applyTransform(_tokenProps: IModelRpcProps, _editorId: GuidString, _tprops: TransformProps) { return this.forward(arguments); }
  public async pushState(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async popState(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
}
