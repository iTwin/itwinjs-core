/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Id64String, Id64Set } from "@bentley/bentleyjs-core";
import { Point2d, Point3d, Vector2d, Vector3d, Range3dProps } from "@bentley/geometry-core";
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
import { IModelCoordinatesResponseProps, GeoCoordinatesResponseProps } from "../GeoCoordinateServices";
import { ViewStateProps } from "../ViewProps";
import { PageOptions } from "../Paging";

/** Response if the IModelDb was not found at the backend
 * (if the service has moved)
 * @public
 */
export class IModelNotFoundResponse extends RpcNotFoundResponse {
}

/** The RPC interface for reading from an iModel.
 * All operations only require read-only access.
 * This interface is not normally used directly. See IModelConnection for higher-level and more convenient API for accessing iModels from a frontend.
 * @public
 */
export abstract class IModelReadRpcInterface extends RpcInterface {
  /** The types that can be marshaled by the interface. */
  public static types = () => [
    IModelVersion,
    IModelToken,
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

  /** The semantic version of the interface. */
  public static version = "0.3.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async openForRead(_iModelToken: IModelToken): Promise<IModel> { return this.forward(arguments); }
  public async close(_iModelToken: IModelToken): Promise<boolean> { return this.forward(arguments); }
  public async queryPage(_iModelToken: IModelToken, _ecsql: string, _bindings?: any[] | object, _options?: PageOptions): Promise<any[]> { return this.forward(arguments); }
  public async queryRowCount(_iModelToken: IModelToken, _ecsql: string, _bindings?: any[] | object): Promise<number> { return this.forward(arguments); }
  public async getModelProps(_iModelToken: IModelToken, _modelIds: Id64Set): Promise<ModelProps[]> { return this.forward(arguments); }
  public async queryModelRanges(_iModelToken: IModelToken, _modelIds: Id64Set): Promise<Range3dProps[]> { return this.forward(arguments); }
  public async queryModelProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<ModelProps[]> { return this.forward(arguments); }
  public async getElementProps(_iModelToken: IModelToken, _elementIds: Id64Set): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryElementProps(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryEntityIds(_iModelToken: IModelToken, _params: EntityQueryParams): Promise<Id64Set> { return this.forward(arguments); }
  public async getClassHierarchy(_iModelToken: IModelToken, _startClassName: string): Promise<string[]> { return this.forward(arguments); }
  public async getAllCodeSpecs(_iModelToken: IModelToken): Promise<any[]> { return this.forward(arguments); }
  public async getViewStateData(_iModelToken: IModelToken, _viewDefinitionId: string): Promise<ViewStateProps> { return this.forward(arguments); }
  public async readFontJson(_iModelToken: IModelToken): Promise<any> { return this.forward(arguments); }
  public async getToolTipMessage(_iModelToken: IModelToken, _elementId: string): Promise<string[]> { return this.forward(arguments); }
  public async getViewThumbnail(_iModelToken: IModelToken, _viewId: string): Promise<Uint8Array> { return this.forward(arguments); }
  public async getDefaultViewId(_iModelToken: IModelToken): Promise<Id64String> { return this.forward(arguments); }
  /** @beta */
  public async requestSnap(_iModelToken: IModelToken, _sessionId: string, _props: SnapRequestProps): Promise<SnapResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async cancelSnap(_iModelToken: IModelToken, _sessionId: string): Promise<void> { return this.forward(arguments); }
  /** @beta */
  public async getIModelCoordinatesFromGeoCoordinates(_iModelToken: IModelToken, _props: string): Promise<IModelCoordinatesResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async getGeoCoordinatesFromIModelCoordinates(_iModelToken: IModelToken, _props: string): Promise<GeoCoordinatesResponseProps> { return this.forward(arguments); }
}
