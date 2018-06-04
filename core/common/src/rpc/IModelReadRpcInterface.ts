/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Id64, Id64Set } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Point2d, Point3d, Vector2d, Vector3d } from "@bentley/geometry-core";
import { Code } from "../Code";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { RpcNotFoundResponse } from "./core/RpcControl";
import { EntityQueryParams } from "../EntityProps";
import { IModel, IModelToken } from "../IModel";
import { IModelVersion } from "../IModelVersion";
import { ModelProps } from "../ModelProps";
import { ElementProps } from "../ElementProps";

/** Response if the IModelDb was not found at the backend
 * (if the service has moved)
 */
export class IModelNotFoundResponse extends RpcNotFoundResponse {
}

/**
 * The RPC interface for reading from an iModel.
 * All operations only require read-only access.
 * This interface is not normally used directly. See IModelConnection for higher-level and more convenient API for accessing iModels from a frontend.
 */
export abstract class IModelReadRpcInterface extends RpcInterface {
  /** The version of the interface. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the interface. */
  public static types = () => [
    AccessToken,
    IModelVersion,
    IModelToken,
    Id64,
    Point2d,
    Point3d,
    Vector2d,
    Vector3d,
    Date,
    Code,
    IModelNotFoundResponse,
  ]

  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): IModelReadRpcInterface { return RpcManager.getClientForInterface(IModelReadRpcInterface); }

  public openForRead(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<IModel> { return this.forward.apply(this, arguments); }
  public close(_accessToken: AccessToken, _iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
  public executeQuery(_iModelToken: IModelToken, _ecsql: string, _bindings?: any[] | object): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getModelProps(_iModelToken: IModelToken, _modelIds: Id64Set): Promise<ModelProps[]> { return this.forward.apply(this, arguments); }
  public queryModelProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<ModelProps[]> { return this.forward.apply(this, arguments); }
  public getElementProps(_iModelToken: IModelToken, _elementIds: Id64Set): Promise<ElementProps[]> { return this.forward.apply(this, arguments); }
  public queryElementProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<ElementProps[]> { return this.forward.apply(this, arguments); }
  public queryEntityIds(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<Id64Set> { return this.forward.apply(this, arguments); }
  public formatElements(_iModelToken: IModelToken, _elementIds: Id64Set): Promise<any[]> { return this.forward.apply(this, arguments); }
  public loadMetaDataForClassHierarchy(_iModelToken: IModelToken, _startClassName: string): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getAllCodeSpecs(_iModelToken: IModelToken): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getViewStateData(_iModelToken: IModelToken, _viewDefinitionId: string): Promise<any> { return this.forward.apply(this, arguments); }
  public readFontJson(_iModelToken: IModelToken): Promise<any> { return this.forward.apply(this, arguments); }
  /** Determines whether the *Change Cache file* is attached to the specified iModel or not
   * @param iModel iModel to check whether a *Change Cache file* is attached
   * @returns Returns true if the *Change Cache file* is attached to the iModel. false otherwise
   */
  public isChangeCacheAttached(_iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
  /** Attaches the Change Cache file to the specified iModel.
   * @throws [IModelError]($common) if a Change Cache file has already been attached before.
   */
  public attachChangeCache(_iModelToken: IModelToken): Promise<void> { return this.forward.apply(this, arguments); }
  /** Detaches the Change Cache file to the specified iModel, if it has been attached before.
   *  > Does not throw if no Change Cache file was attached before. This is a different behavior from the
   *  > backend method to make the RPC call chunkier by not requiring clients to call
   *  > [[isChangeCacheAttached]].
   */
  public detachChangeCache(_iModelToken: IModelToken): Promise<void> { return this.forward.apply(this, arguments); }
}
