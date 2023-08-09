/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { CompressedId64Set, GuidString, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Range3dProps } from "@itwin/core-geometry";
import { CodeProps } from "../Code";
import { DbBlobRequest, DbBlobResponse, DbQueryRequest, DbQueryResponse } from "../ConcurrentQuery";
import { ElementMeshRequestProps } from "../ElementMesh";
import { ElementLoadOptions, ElementProps } from "../ElementProps";
import { EntityQueryParams } from "../EntityProps";
import { FontMapProps } from "../Fonts";
import {
  GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, IModelCoordinatesRequestProps, IModelCoordinatesResponseProps,
} from "../GeoCoordinateServices";
import { GeometryContainmentRequestProps, GeometryContainmentResponseProps } from "../GeometryContainment";
import { GeometrySummaryRequestProps } from "../GeometrySummary";
import { IModelConnectionProps, IModelRpcOpenProps, IModelRpcProps } from "../IModel";
import {
  MassPropertiesPerCandidateRequestProps, MassPropertiesPerCandidateResponseProps, MassPropertiesRequestProps, MassPropertiesResponseProps,
} from "../MassProperties";
import { ModelProps } from "../ModelProps";
import { RpcInterface } from "../RpcInterface";
import { RpcManager } from "../RpcManager";
import { SnapRequestProps, SnapResponseProps } from "../Snapping";
import { TextureData, TextureLoadProps } from "../TextureProps";
import {
  CustomViewState3dCreatorOptions, CustomViewState3dProps, HydrateViewStateRequestProps, HydrateViewStateResponseProps, SubCategoryResultRow,
  ViewStateLoadProps, ViewStateProps,
} from "../ViewProps";
import { RpcResponseCacheControl } from "./core/RpcConstants";
import { RpcNotFoundResponse } from "./core/RpcControl";
import { RpcOperation } from "./core/RpcOperation";
import { RpcRoutingToken } from "./core/RpcRoutingToken";

/** Response if the IModelDb was not found at the backend
 * (if the service has moved)
 * @public
 */
export class IModelNotFoundResponse extends RpcNotFoundResponse { // eslint-disable-line deprecation/deprecation
  public isIModelNotFoundResponse: boolean = true;
  public override message = "iModel not found";
}

/** Describes the volume of geometry contained with a [GeometricModel]($backend) as returned by
 * [IModelConnection.Models.queryExtents]($frontend) and [IModelDb.Models.queryExtents]($backend).
 * @public
 */
export interface ModelExtentsProps {
  /** The Id of the model, or [Id64.invalid]($bentley) if the input model Id was not a well-formed [Id64String]($bentley). */
  id: Id64String;
  /** The volume of geometry contained within the model.
   * This range will be null (@see [Range3d.isNull]($geometry)) if [[status]] is not [IModelStatus.Success]($bentley) or the model contains no geometry.
   */
  extents: Range3dProps;
  /** A status code indicating what if any error occurred obtaining the model's extents. For example:
   *  - [IModelStatus.InvalidId]($bentley) if the input model Id was not a well-formed [Id64String]($bentley);
   *  - [IModelStatus.NotFound]($bentley) if no model with the specified Id exists in the [[IModel]];
   *  - [IModelStatus.WrongModel]($bentley) if the specified model is not a [GeometricModel]($backend); or
   *  - [IModelStatus.Success]($bentley) if the extents were successfully obtained.
   *
   * If `status` is anything other than [IModelStatus.Success]($bentley), [[extents]] will be a null range.
   */
  status: IModelStatus;
}

/** The RPC interface for reading from an iModel.
 * All operations only require read-only access.
 * This interface is not normally used directly. See IModelConnection for higher-level and more convenient API for accessing iModels from a frontend.
 * @internal
 */
export abstract class IModelReadRpcInterface extends RpcInterface { // eslint-disable-line deprecation/deprecation
  /** Returns the IModelReadRpcInterface instance for the frontend. */
  public static getClient(): IModelReadRpcInterface { return RpcManager.getClientForInterface(IModelReadRpcInterface); }

  /** Returns the IModelReadRpcInterface instance for a custom RPC routing configuration. */
  public static getClientForRouting(token: RpcRoutingToken): IModelReadRpcInterface { return RpcManager.getClientForInterface(IModelReadRpcInterface, token); }

  /** The immutable name of the interface. */
  public static readonly interfaceName = "IModelReadRpcInterface";

  /** The semantic version of the interface. */
  public static interfaceVersion = "3.6.0";

  /*===========================================================================================
    NOTE: Any add/remove/change to the methods below requires an update of the interface version.
    NOTE: Please consult the README in this folder for the semantic versioning rules.
  ===========================================================================================*/
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getConnectionProps(_iModelToken: IModelRpcOpenProps): Promise<IModelConnectionProps> { return this.forward(arguments); }
  public async queryRows(_iModelToken: IModelRpcProps, _request: DbQueryRequest): Promise<DbQueryResponse> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async querySubCategories(_iModelToken: IModelRpcProps, _categoryIds: CompressedId64Set): Promise<SubCategoryResultRow[]> { return this.forward(arguments); }
  public async queryBlob(_iModelToken: IModelRpcProps, _request: DbBlobRequest): Promise<DbBlobResponse> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getModelProps(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<ModelProps[]> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async queryModelRanges(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<Range3dProps[]> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async queryModelExtents(_iModelToken: IModelRpcProps, _modelIds: Id64String[]): Promise<ModelExtentsProps[]> { return this.forward(arguments); }
  public async queryModelProps(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<ModelProps[]> { return this.forward(arguments); }
  public async getElementProps(_iModelToken: IModelRpcProps, _elementIds: Id64String[]): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryElementProps(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<ElementProps[]> { return this.forward(arguments); }
  public async queryEntityIds(_iModelToken: IModelRpcProps, _params: EntityQueryParams): Promise<Id64String[]> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getClassHierarchy(_iModelToken: IModelRpcProps, _startClassName: string): Promise<string[]> { return this.forward(arguments); }
  public async getAllCodeSpecs(_iModelToken: IModelRpcProps): Promise<any[]> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getViewStateData(_iModelToken: IModelRpcProps, _viewDefinitionId: string, _options?: ViewStateLoadProps): Promise<ViewStateProps> { return this.forward(arguments); }
  public async readFontJson(_iModelToken: IModelRpcProps): Promise<FontMapProps> { return this.forward(arguments); }
  public async getToolTipMessage(_iModelToken: IModelRpcProps, _elementId: string): Promise<string[]> { return this.forward(arguments); }
  /** @deprecated in 3.x use ViewStore apis. */
  public async getViewThumbnail(_iModelToken: IModelRpcProps, _viewId: string): Promise<Uint8Array> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getDefaultViewId(_iModelToken: IModelRpcProps): Promise<Id64String> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getCustomViewState3dData(_iModelToken: IModelRpcProps, _options: CustomViewState3dCreatorOptions): Promise<CustomViewState3dProps> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async hydrateViewState(_iModelToken: IModelRpcProps, _options: HydrateViewStateRequestProps): Promise<HydrateViewStateResponseProps> { return this.forward(arguments); }
  public async requestSnap(_iModelToken: IModelRpcProps, _sessionId: string, _props: SnapRequestProps): Promise<SnapResponseProps> { return this.forward(arguments); }
  public async cancelSnap(_iModelToken: IModelRpcProps, _sessionId: string): Promise<void> { return this.forward(arguments); }
  public async getGeometryContainment(_iModelToken: IModelRpcProps, _props: GeometryContainmentRequestProps): Promise<GeometryContainmentResponseProps> { return this.forward(arguments); }
  public async getMassProperties(_iModelToken: IModelRpcProps, _props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> { return this.forward(arguments); }
  public async getMassPropertiesPerCandidate(_iModelToken: IModelRpcProps, _props: MassPropertiesPerCandidateRequestProps): Promise<MassPropertiesPerCandidateResponseProps[]> { return this.forward(arguments); }
  public async getIModelCoordinatesFromGeoCoordinates(_iModelToken: IModelRpcProps, _props: IModelCoordinatesRequestProps): Promise<IModelCoordinatesResponseProps> { return this.forward(arguments); }
  @RpcOperation.allowResponseCaching(RpcResponseCacheControl.Immutable) // eslint-disable-line deprecation/deprecation
  public async getGeoCoordinatesFromIModelCoordinates(_iModelToken: IModelRpcProps, _props: GeoCoordinatesRequestProps): Promise<GeoCoordinatesResponseProps> { return this.forward(arguments); }
  public async getGeometrySummary(_iModelToken: IModelRpcProps, _props: GeometrySummaryRequestProps): Promise<string> { return this.forward(arguments); }
  public async queryTextureData(_iModelToken: IModelRpcProps, _textureLoadProps: TextureLoadProps): Promise<TextureData | undefined> { return this.forward(arguments); }
  public async loadElementProps(_iModelToken: IModelRpcProps, _elementIdentifier: Id64String | GuidString | CodeProps, _options?: ElementLoadOptions): Promise<ElementProps | undefined> {
    return this.forward(arguments);
  }
  public async generateElementMeshes(_iModelToken: IModelRpcProps, _props: ElementMeshRequestProps): Promise<Uint8Array> {
    return this.forward(arguments);
  }
  /** @internal */
  public async callViewStore(_iModelToken: IModelRpcProps, _version: string, _forWrite: boolean, _methodName: string, ..._args: any[]): Promise<any> { return this.forward(arguments); }
}
