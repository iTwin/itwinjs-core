/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
import { SnapRequestProps, SnapResponseProps } from "../Snapping";
import { ViewStateData } from "../ViewProps";

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
  public getClassHierarchy(_iModelToken: IModelToken, _startClassName: string): Promise<string[]> { return this.forward.apply(this, arguments); }
  public getAllCodeSpecs(_iModelToken: IModelToken): Promise<any[]> { return this.forward.apply(this, arguments); }
  public getViewStateData(_iModelToken: IModelToken, _viewDefinitionId: string): Promise<ViewStateData> { return this.forward.apply(this, arguments); }
  public readFontJson(_iModelToken: IModelToken): Promise<any> { return this.forward.apply(this, arguments); }
  public isChangeCacheAttached(_iModelToken: IModelToken): Promise<boolean> { return this.forward.apply(this, arguments); }
  public attachChangeCache(_iModelToken: IModelToken): Promise<void> { return this.forward.apply(this, arguments); }
  public detachChangeCache(_iModelToken: IModelToken): Promise<void> { return this.forward.apply(this, arguments); }
  public requestSnap(_iModelToken: IModelToken, _connectionId: string, _props: SnapRequestProps): Promise<SnapResponseProps> { return this.forward.apply(this, arguments); }
  public cancelSnap(_iModelToken: IModelToken, _connectionId: string): Promise<void> { return this.forward.apply(this, arguments); }
  public loadNativeAsset(_iModelToken: IModelToken, _assetName: string): Promise<Uint8Array> { return this.forward.apply(this, arguments); }
  public getToolTipMessage(_iModelToken: IModelToken, _elementId: string): Promise<string[]> { return this.forward.apply(this, arguments); }
  public getViewThumbnail(_iModelToken: IModelToken, _viewId: string): Promise<Uint8Array> { return this.forward.apply(this, arguments); }
  public getDefaultViewId(_iModelToken: IModelToken): Promise<Id64> { return this.forward.apply(this, arguments); }
}
