/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { GuidString, Id64String } from "@bentley/bentleyjs-core";
import { Range3dProps } from "@bentley/geometry-core";
import { ElementLoadOptions, ElementProps } from "../ElementProps";
import { CodeProps } from "../Code";
import { EntityQueryParams } from "../EntityProps";
import { GeoCoordinatesResponseProps, IModelCoordinatesResponseProps } from "../GeoCoordinateServices";
import { GeometrySummaryRequestProps } from "../GeometrySummary";
import { IModelConnectionProps, IModelRpcOpenProps, IModelRpcProps } from "../IModel";
import { MassPropertiesRequestProps, MassPropertiesResponseProps } from "../MassProperties";
import { ModelProps } from "../ModelProps";
import { QueryLimit, QueryPriority, QueryQuota, QueryResponse } from "../Paging";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { SnapRequestProps, SnapResponseProps } from "../Snapping";
import { ViewStateLoadProps, ViewStateProps } from "../ViewProps";
import { RpcNotFoundResponse } from "./core/RpcControl";
import { GeometryContainmentRequestProps, GeometryContainmentResponseProps } from "../GeometryContainment";
import { RpcRoutingToken } from "./core/RpcRoutingToken";
import { TextureLoadProps } from "../TextureProps";

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

  /** Returns the IModelReadRpcInterface instance for a custom RPC routing configuration. */
  public static getClientForRouting(token: RpcRoutingToken): IModelReadRpcInterface { return RpcManager.getClientForInterface(IModelReadRpcInterface, token); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelReadRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "2.3.1";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  public async openForRead(_iModelToken: IModelRpcOpenProps): Promise<IModelConnectionProps> { return this.forward(arguments); }
  public async close(_iModelToken: IModelRpcProps): Promise<boolean> { return this.forward(arguments); }
  public async queryRows(_iModelToken: IModelRpcProps, _ecsql: string, _bindings?: any[] | object, _limit?: QueryLimit, _quota?: QueryQuota, _priority?: QueryPriority, _restartToken?: string, _abbreviateBlobs?: boolean): Promise<QueryResponse> { return this.forward(arguments); }
  public async getModelProps(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<ModelProps[]> { return this.forward(arguments); }
  public async queryModelRanges(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<Range3dProps[]> { return this.forward(arguments); }
  public async queryModelProps(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<ModelProps[]> { return this.forward(arguments); }
  public async getElementProps(_iModelToken: IModelRpcProps, _elementIds: Id64String[]): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryElementProps(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryEntityIds(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<Id64String[]> { return this.forward(arguments); }
  public async getClassHierarchy(_iModelToken: IModelRpcProps, _startClassName: string): Promise<string[]> { return this.forward(arguments); }
  public async getAllCodeSpecs(_iModelToken: IModelRpcProps): Promise<any[]> { return this.forward(arguments); }
  public async getViewStateData(_iModelToken: IModelRpcProps, _viewDefinitionId: string, _options?: ViewStateLoadProps): Promise<ViewStateProps> { return this.forward(arguments); }
  public async readFontJson(_iModelToken: IModelRpcProps): Promise<any> { return this.forward(arguments); }
  public async getToolTipMessage(_iModelToken: IModelRpcProps, _elementId: string): Promise<string[]> { return this.forward(arguments); }
  public async getViewThumbnail(_iModelToken: IModelRpcProps, _viewId: string): Promise<Uint8Array> { return this.forward(arguments); }
  public async getDefaultViewId(_iModelToken: IModelRpcProps): Promise<Id64String> { return this.forward(arguments); }
  public async requestSnap(_iModelToken: IModelRpcProps, _sessionId: string, _props: SnapRequestProps): Promise<SnapResponseProps> { return this.forward(arguments); }
  public async cancelSnap(_iModelToken: IModelRpcProps, _sessionId: string): Promise<void> { return this.forward(arguments); }
  public async getGeometryContainment(_iModelToken: IModelRpcProps, _props: GeometryContainmentRequestProps): Promise<GeometryContainmentResponseProps> { return this.forward(arguments); }
  public async getMassProperties(_iModelToken: IModelRpcProps, _props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> { return this.forward(arguments); }
  public async getIModelCoordinatesFromGeoCoordinates(_iModelToken: IModelRpcProps, _props: string): Promise<IModelCoordinatesResponseProps> { return this.forward(arguments); }
  public async getGeoCoordinatesFromIModelCoordinates(_iModelToken: IModelRpcProps, _props: string): Promise<GeoCoordinatesResponseProps> { return this.forward(arguments); }
  public async getGeometrySummary(_iModelToken: IModelRpcProps, _props: GeometrySummaryRequestProps): Promise<string> { return this.forward(arguments); }
  public async getTextureImage(_iModelToken: IModelRpcProps, _textureLoadProps: TextureLoadProps): Promise<Uint8Array | undefined> { return this.forward(arguments); }

  public async loadElementProps(_iModelToken: IModelRpcProps, _elementIdentifier: Id64String | GuidString | CodeProps, _options?: ElementLoadOptions): Promise<ElementProps | undefined> {
    return this.forward(arguments);
  }
}
