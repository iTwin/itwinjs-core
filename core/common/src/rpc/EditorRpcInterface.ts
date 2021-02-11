/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { GuidString, Id64Array } from "@bentley/bentleyjs-core";
import { Point3d, TransformProps, YawPitchRollAngles } from "@bentley/geometry-core";
import { GeometricElement3dProps } from "../ElementProps";
import { IModelRpcProps } from "../IModel";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";

/* eslint-disable deprecation/deprecation */

/** @alpha */
export enum Editor3dRpcInterfaceWriteReturnType {
  /** don't return anything from write */
  None,
  /** return the ECInstanceIds of the elements written */
  Ids,
  /** return the GeometricElement3dProps of the elements written */
  Props,
}

/** @alpha */
export interface Editor3dRpcInterfaceWriteReturnPropsOptions {
  /** The returned GeometricElement3dProps should contain geometry. */
  geometry?: boolean;
}

/** @alpha */
export interface Editor3dRpcInterfaceWriteOptions {
  /** Specifies what, if anything, the write method should return. By default, write returns void. */
  returnType?: Editor3dRpcInterfaceWriteReturnType;
  /** If props are to be returned, what should be included? By default, geometry is not returned in the props. All other properties are included. */
  returnPropsOptions?: Editor3dRpcInterfaceWriteReturnPropsOptions;
}

/** The RPC interface for editing Spatial and other 3D elements and Models in an iModel.
 * All operations require read+write access.
 * @alpha
 * @deprecated use EditCommands
 */
export abstract class Editor3dRpcInterface extends RpcInterface {
  /** Returns the client instance for the frontend. */
  public static getClient(): Editor3dRpcInterface { return RpcManager.getClientForInterface(Editor3dRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "Editor3dRpcInterface";

  /** The version of the interface. */
  public static interfaceVersion = "0.0.2";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async start(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async end(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async writeAllChangesToBriefcase(_tokenProps: IModelRpcProps, _editorId: GuidString, _opts: Editor3dRpcInterfaceWriteOptions): Promise<GeometricElement3dProps[] | Id64Array | void> { return this.forward(arguments); }
  public async startModifyingElements(_tokenProps: IModelRpcProps, _editorId: GuidString, _elementIds: Id64Array): Promise<void> { return this.forward(arguments); }
  public async createElement(_tokenProps: IModelRpcProps, _editorId: GuidString, _props: GeometricElement3dProps, _origin?: Point3d, _angles?: YawPitchRollAngles, _geometry?: any): Promise<void> { return this.forward(arguments); }
  public async applyTransform(_tokenProps: IModelRpcProps, _editorId: GuidString, _tprops: TransformProps) { return this.forward(arguments); }
  public async pushState(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
  public async popState(_tokenProps: IModelRpcProps, _editorId: GuidString): Promise<void> { return this.forward(arguments); }
}
