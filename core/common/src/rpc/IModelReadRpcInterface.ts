/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { Id64String } from "@bentley/bentleyjs-core";
import { Range3dProps } from "@bentley/geometry-core";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { RpcNotFoundResponse } from "./core/RpcControl";
import { EntityQueryParams } from "../EntityProps";
import { IModelTokenProps, IModelProps } from "../IModel";
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
  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): IModelReadRpcInterface { return RpcManager.getClientForInterface(IModelReadRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelReadRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "0.4.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async openForRead(_iModelToken: IModelTokenProps): Promise<IModelProps> { return this.forward(arguments); }
  public async close(_iModelToken: IModelTokenProps): Promise<boolean> { return this.forward(arguments); }
  public async queryPage(_iModelToken: IModelTokenProps, _ecsql: string, _bindings?: any[] | object, _options?: PageOptions): Promise<any[]> { return this.forward(arguments); }
  public async queryRowCount(_iModelToken: IModelTokenProps, _ecsql: string, _bindings?: any[] | object): Promise<number> { return this.forward(arguments); }
  public async getModelProps(_iModelToken: IModelTokenProps, _modelIds: Id64String[]): Promise<ModelProps[]> { return this.forward(arguments); }
  public async queryModelRanges(_iModelToken: IModelTokenProps, _modelIds: Id64String[]): Promise<Range3dProps[]> { return this.forward(arguments); }
  public async queryModelProps(_iModelToken: IModelTokenProps, _params: EntityQueryParams): Promise<ModelProps[]> { return this.forward(arguments); }
  public async getElementProps(_iModelToken: IModelTokenProps, _elementIds: Id64String[]): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryElementProps(_iModelToken: IModelTokenProps, _params: EntityQueryParams): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryEntityIds(_iModelToken: IModelTokenProps, _params: EntityQueryParams): Promise<Id64String[]> { return this.forward(arguments); }
  public async getClassHierarchy(_iModelToken: IModelTokenProps, _startClassName: string): Promise<string[]> { return this.forward(arguments); }
  public async getAllCodeSpecs(_iModelToken: IModelTokenProps): Promise<any[]> { return this.forward(arguments); }
  public async getViewStateData(_iModelToken: IModelTokenProps, _viewDefinitionId: string): Promise<ViewStateProps> { return this.forward(arguments); }
  public async readFontJson(_iModelToken: IModelTokenProps): Promise<any> { return this.forward(arguments); }
  public async getToolTipMessage(_iModelToken: IModelTokenProps, _elementId: string): Promise<string[]> { return this.forward(arguments); }
  public async getViewThumbnail(_iModelToken: IModelTokenProps, _viewId: string): Promise<Uint8Array> { return this.forward(arguments); }
  public async getDefaultViewId(_iModelToken: IModelTokenProps): Promise<Id64String> { return this.forward(arguments); }
  /** @beta */
  public async requestSnap(_iModelToken: IModelTokenProps, _sessionId: string, _props: SnapRequestProps): Promise<SnapResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async cancelSnap(_iModelToken: IModelTokenProps, _sessionId: string): Promise<void> { return this.forward(arguments); }
  /** @beta */
  public async getIModelCoordinatesFromGeoCoordinates(_iModelToken: IModelTokenProps, _props: string): Promise<IModelCoordinatesResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async getGeoCoordinatesFromIModelCoordinates(_iModelToken: IModelTokenProps, _props: string): Promise<GeoCoordinatesResponseProps> { return this.forward(arguments); }
}
