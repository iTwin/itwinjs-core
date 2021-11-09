/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { GuidString, Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import {
  Code, CodeProps, DbBlobRequest, DbBlobResponse, DbQueryRequest, DbQueryResponse, ElementLoadOptions, ElementLoadProps, ElementProps, EntityMetaData,
  EntityQueryParams, FontMapProps, GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, GeometryContainmentRequestProps,
  GeometryContainmentResponseProps, GeometrySummaryRequestProps, ImageSourceFormat, IModel, IModelConnectionProps, IModelCoordinatesRequestProps,
  IModelCoordinatesResponseProps, IModelError, IModelReadRpcInterface, IModelRpcOpenProps, IModelRpcProps, MassPropertiesRequestProps,
  MassPropertiesResponseProps, ModelProps, NoContentError, RpcInterface, RpcManager, SnapRequestProps, SnapResponseProps, SyncMode,
  TextureData, TextureLoadProps, ViewStateLoadProps, ViewStateProps,
} from "@itwin/core-common";
import { Range3d, Range3dProps } from "@itwin/core-geometry";
import { SpatialCategory } from "../Category";
import { ConcurrentQuery } from "../ConcurrentQuery";
import { generateGeometrySummaries } from "../GeometrySummary";
import { DictionaryModel } from "../Model";
import { RpcBriefcaseUtility } from "./RpcBriefcaseUtility";
import { RpcTrace } from "../RpcBackend";

/** The backend implementation of IModelReadRpcInterface.
 * @internal
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async getConnectionProps(tokenProps: IModelRpcOpenProps): Promise<IModelConnectionProps> {
    return RpcBriefcaseUtility.openWithTimeout(RpcTrace.expectCurrentActivity, tokenProps, SyncMode.FixedVersion);
  }

  public async queryRows(tokenProps: IModelRpcProps, request: DbQueryRequest): Promise<DbQueryResponse> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return ConcurrentQuery.executeQueryRequest(iModelDb.nativeDb, request);
  }
  public async queryBlob(tokenProps: IModelRpcProps, request: DbBlobRequest): Promise<DbBlobResponse> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return ConcurrentQuery.executeBlobRequest(iModelDb.nativeDb, request);
  }
  public async queryModelRanges(tokenProps: IModelRpcProps, modelIdsList: Id64String[]): Promise<Range3dProps[]> {
    const modelIds = new Set(modelIdsList);
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const ranges: Range3dProps[] = [];
    for (const id of modelIds) {
      try {
        ranges.push(iModelDb.nativeDb.queryModelExtents({ id }).modelExtents);
      } catch (err: any) {
        if ((err as IModelError).errorNumber === IModelStatus.NoGeometry) { // if there was no geometry, just return null range
          ranges.push(new Range3d());
          continue;
        }

        if (modelIds.size === 1)
          throw err; // if they're asking for more than one model, don't throw on error.
        continue;
      }
    }
    return ranges;
  }

  public async getModelProps(tokenProps: IModelRpcProps, modelIdsList: Id64String[]): Promise<ModelProps[]> {
    const modelIds = new Set(modelIdsList);
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const modelJsonArray: ModelProps[] = [];
    for (const id of modelIds) {
      try {
        const modelProps = iModelDb.models.getModelJson({ id });
        modelJsonArray.push(modelProps);
      } catch (error) {
        if (modelIds.size === 1)
          throw error; // if they're asking for more than one model, don't throw on error.
      }
    }
    return modelJsonArray;
  }

  public async queryModelProps(tokenProps: IModelRpcProps, params: EntityQueryParams): Promise<ModelProps[]> {
    const ids = await this.queryEntityIds(tokenProps, params);
    return this.getModelProps(tokenProps, [...ids]);
  }

  public async getElementProps(tokenProps: IModelRpcProps, elementIdsList: Id64String[]): Promise<ElementProps[]> {
    const elementIds = new Set(elementIdsList);
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const elementProps: ElementProps[] = [];
    for (const id of elementIds) {
      try {
        elementProps.push(iModelDb.elements.getElementJson({ id }));
      } catch (error) {
        if (elementIds.size === 1)
          throw error; // if they're asking for more than one element, don't throw on error.
      }
    }
    return elementProps;
  }

  public async loadElementProps(tokenProps: IModelRpcProps, identifier: Id64String | GuidString | CodeProps, options?: ElementLoadOptions): Promise<ElementProps | undefined> {
    const props: ElementLoadProps = options ? { ...options } : {};
    if (typeof identifier === "string") {
      if (Id64.isId64(identifier))
        props.id = identifier;
      else
        props.federationGuid = identifier;
    } else {
      props.code = Code.fromJSON(identifier);
    }

    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.elements.tryGetElementProps(props);
  }

  public async getGeometrySummary(tokenProps: IModelRpcProps, request: GeometrySummaryRequestProps): Promise<string> {
    const iModel = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return generateGeometrySummaries(request, iModel);
  }

  public async queryElementProps(tokenProps: IModelRpcProps, params: EntityQueryParams): Promise<ElementProps[]> {
    const ids = await this.queryEntityIds(tokenProps, params);
    const res = this.getElementProps(tokenProps, [...ids]);
    return res;
  }

  public async queryEntityIds(tokenProps: IModelRpcProps, params: EntityQueryParams): Promise<Id64String[]> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const res = iModelDb.queryEntityIds(params);
    return [...res];
  }

  public async getClassHierarchy(tokenProps: IModelRpcProps, classFullName: string): Promise<string[]> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const classArray: string[] = [];
    while (true) {
      const classMetaData: EntityMetaData = iModelDb.getMetaData(classFullName);
      classArray.push(classFullName);
      if (!classMetaData.baseClasses || classMetaData.baseClasses.length === 0)
        break;

      classFullName = classMetaData.baseClasses[0];
    }
    return classArray;
  }

  public async getAllCodeSpecs(tokenProps: IModelRpcProps): Promise<any[]> {
    const codeSpecs: any[] = [];
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    iModelDb.withPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec", (statement) => {
      for (const row of statement)
        codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });
    });
    return codeSpecs;
  }

  public async getViewStateData(tokenProps: IModelRpcProps, viewDefinitionId: string, options?: ViewStateLoadProps): Promise<ViewStateProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.views.getViewStateData(viewDefinitionId, options);
  }

  public async readFontJson(tokenProps: IModelRpcProps): Promise<FontMapProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.nativeDb.readFontMap();
  }

  public async requestSnap(tokenProps: IModelRpcProps, sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.requestSnap(sessionId, props);
  }

  public async cancelSnap(tokenProps: IModelRpcProps, sessionId: string): Promise<void> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.cancelSnap(sessionId);
  }

  public async getGeometryContainment(tokenProps: IModelRpcProps, props: GeometryContainmentRequestProps): Promise<GeometryContainmentResponseProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.getGeometryContainment(props);
  }

  public async getMassProperties(tokenProps: IModelRpcProps, props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.getMassProperties(props);
  }

  public async getToolTipMessage(tokenProps: IModelRpcProps, id: string): Promise<string[]> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const el = iModelDb.elements.getElement(id);
    return (el === undefined) ? [] : el.getToolTipMessage();
  }

  /** Send a view thumbnail to the frontend. This is a binary transfer with the metadata in a 16-byte prefix header. */
  public async getViewThumbnail(tokenProps: IModelRpcProps, viewId: string): Promise<Uint8Array> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const thumbnail = iModelDb.views.getThumbnail(viewId);
    if (undefined === thumbnail || 0 === thumbnail.image.length)
      throw new NoContentError();

    const val = new Uint8Array(thumbnail.image.length + 16); // allocate a new buffer 16 bytes larger than the image size
    new Uint32Array(val.buffer, 0, 4).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]);    // Put the metadata in the first 16 bytes.
    val.set(thumbnail.image, 16); // put the image data at offset 16 after metadata
    return val;
  }

  public async getDefaultViewId(tokenProps: IModelRpcProps): Promise<Id64String> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const spec = { namespace: "dgn_View", name: "DefaultView" };
    const blob = iModelDb.queryFilePropertyBlob(spec);
    if (undefined === blob || 8 !== blob.length)
      return Id64.invalid;

    const view = new Uint32Array(blob.buffer);
    return Id64.fromUint32Pair(view[0], view[1]);
  }
  public async getSpatialCategoryId(tokenProps: IModelRpcProps, categoryName: string): Promise<Id64String | undefined> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const dictionary: DictionaryModel = iModelDb.models.getModel<DictionaryModel>(IModel.dictionaryId);
    return SpatialCategory.queryCategoryIdByName(iModelDb, dictionary.id, categoryName);
  }

  public async getIModelCoordinatesFromGeoCoordinates(tokenProps: IModelRpcProps, props: IModelCoordinatesRequestProps): Promise<IModelCoordinatesResponseProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.getIModelCoordinatesFromGeoCoordinates(props);
  }

  public async getGeoCoordinatesFromIModelCoordinates(tokenProps: IModelRpcProps, props: GeoCoordinatesRequestProps): Promise<GeoCoordinatesResponseProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModelDb.getGeoCoordinatesFromIModelCoordinates(props);
  }

  public async queryTextureData(tokenProps: IModelRpcProps, textureLoadProps: TextureLoadProps): Promise<TextureData | undefined> {
    const db = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return db.queryTextureData(textureLoadProps);
  }
}
