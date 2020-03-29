/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { Range3dProps } from "@bentley/geometry-core";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { RpcNotFoundResponse } from "./core/RpcControl";
import { EntityQueryParams } from "../EntityProps";
import { IModelRpcProps, IModelConnectionProps } from "../IModel";
import { ModelProps } from "../ModelProps";
import { ElementProps } from "../ElementProps";
import { SnapRequestProps, SnapResponseProps } from "../Snapping";
import { MassPropertiesRequestProps, MassPropertiesResponseProps } from "../MassProperties";
import { GeometrySummaryRequestProps } from "../GeometrySummary";
import { IModelCoordinatesResponseProps, GeoCoordinatesResponseProps } from "../GeoCoordinateServices";
import { ViewStateProps } from "../ViewProps";
import { QueryPriority, QueryResponse, QueryLimit, QueryQuota } from "../Paging";

/** Response if the IModelDb was not found at the backend
 * (if the service has moved)
 * @public
 */
export class IModelNotFoundResponse extends RpcNotFoundResponse {
  public isIModelNotFoundResponse: boolean = true;
}

/** The RPC interface for reading from an iModel.
 * All operations only require read-only access.
 * This interface is not normally used directly. See IModelConnection for higher-level and more convenient API for accessing iModels from a frontend.
 * @internal
 */
export abstract class IModelReadRpcInterface extends RpcInterface {
  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): IModelReadRpcInterface { return RpcManager.getClientForInterface(IModelReadRpcInterface); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelReadRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "1.1.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async openForRead(_iModelToken: IModelRpcProps): Promise<IModelConnectionProps> { return this.forward(arguments); }
  public async close(_iModelToken: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }
  public async queryRows(_iModelToken: IModelRpcProps, _ecsql: string, _bindings?: any[] | object, _limit?: QueryLimit, _quota?: QueryQuota, _priority?: QueryPriority): Promise<QueryResponse> { return this.forward(arguments); }
  public async getModelProps(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<ModelProps[]> { return this.forward(arguments); }
  public async queryModelRanges(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<Range3dProps[]> { return this.forward(arguments); }
  public async queryModelProps(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<ModelProps[]> { return this.forward(arguments); }
  public async getElementProps(_iModelToken: IModelRpcProps, _elementIds: Id64String[]): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryElementProps(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryEntityIds(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<Id64String[]> { return this.forward(arguments); }
  public async getClassHierarchy(_iModelToken: IModelRpcProps, _startClassName: string): Promise<string[]> { return this.forward(arguments); }
  public async getAllCodeSpecs(_iModelToken: IModelRpcProps): Promise<any[]> { return this.forward(arguments); }
  public async getViewStateData(_iModelToken: IModelRpcProps, _viewDefinitionId: string): Promise<ViewStateProps> { return this.forward(arguments); }
  public async readFontJson(_iModelToken: IModelRpcProps): Promise<any> { return this.forward(arguments); }
  public async getToolTipMessage(_iModelToken: IModelRpcProps, _elementId: string): Promise<string[]> { return this.forward(arguments); }
  public async getViewThumbnail(_iModelToken: IModelRpcProps, _viewId: string): Promise<Uint8Array> { return this.forward(arguments); }
  public async getDefaultViewId(_iModelToken: IModelRpcProps): Promise<Id64String> { return this.forward(arguments); }
  /** @beta */
  public async requestSnap(_iModelToken: IModelRpcProps, _sessionId: string, _props: SnapRequestProps): Promise<SnapResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async cancelSnap(_iModelToken: IModelRpcProps, _sessionId: string): Promise<void> { return this.forward(arguments); }
  /** @beta */
  public async getMassProperties(_iModelToken: IModelRpcProps, _props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async getIModelCoordinatesFromGeoCoordinates(_iModelToken: IModelRpcProps, _props: string): Promise<IModelCoordinatesResponseProps> { return this.forward(arguments); }
  /** @beta */
  public async getGeoCoordinatesFromIModelCoordinates(_iModelToken: IModelRpcProps, _props: string): Promise<GeoCoordinatesResponseProps> { return this.forward(arguments); }
  /** @alpha */
  public async getGeometrySummary(_iModelToken: IModelRpcProps, _props: GeometrySummaryRequestProps): Promise<string> { return this.forward(arguments); }
}
