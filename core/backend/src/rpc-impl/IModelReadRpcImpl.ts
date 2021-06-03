/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { ClientRequestContext, GuidString, Id64, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { Range3d, Range3dProps } from "@bentley/geometry-core";
import {
  Code, CodeProps, ElementLoadOptions, ElementLoadProps, ElementProps, EntityMetaData, EntityQueryParams, GeoCoordinatesResponseProps, GeometryContainmentRequestProps,
  GeometryContainmentResponseProps, GeometrySummaryRequestProps, ImageSourceFormat, IModel, IModelConnectionProps, IModelCoordinatesResponseProps, IModelReadRpcInterface,
  IModelRpcOpenProps, IModelRpcProps, MassPropertiesRequestProps, MassPropertiesResponseProps, ModelProps, NoContentError, QueryLimit, QueryPriority, QueryQuota, QueryResponse,
  RpcInterface, RpcManager, SnapRequestProps, SnapResponseProps, SyncMode, TextureLoadProps, ViewStateLoadProps, ViewStateProps,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { SpatialCategory } from "../Category";
import { generateGeometrySummaries } from "../GeometrySummary";
import { IModelDb } from "../IModelDb";
import { DictionaryModel } from "../Model";
import { RpcBriefcaseUtility } from "./RpcBriefcaseUtility";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The backend implementation of IModelReadRpcInterface.
 * @internal
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async openForRead(tokenProps: IModelRpcOpenProps): Promise<IModelConnectionProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return RpcBriefcaseUtility.openWithTimeout(requestContext, tokenProps, SyncMode.FixedVersion);
  }

  public async close(tokenProps: IModelRpcProps): Promise<boolean> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return RpcBriefcaseUtility.close(requestContext, tokenProps);
  }

  public async queryRows(tokenProps: IModelRpcProps, ecsql: string, bindings?: any[] | object, limit?: QueryLimit, quota?: QueryQuota, priority?: QueryPriority, restartToken?: string, abbreviateBlobs?: boolean): Promise<QueryResponse> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb: IModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    return iModelDb.queryRows(ecsql, bindings, limit, quota, priority, restartToken, abbreviateBlobs);
  }

  public async queryModelRanges(tokenProps: IModelRpcProps, modelIdsList: Id64String[]): Promise<Range3dProps[]> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const modelIds = new Set(modelIdsList);
    const iModelDb: IModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    const ranges: Range3dProps[] = [];
    for (const id of modelIds) {
      const val = iModelDb.nativeDb.queryModelExtents(JSON.stringify({ id: id.toString() }));
      if (val.error) {
        if (val.error.status === IModelStatus.NoGeometry) { // if there was no geometry, just return null range
          ranges.push(new Range3d());
          continue;
        }

        if (modelIds.size === 1)
          throw val.error; // if they're asking for more than one model, don't throw on error.
        continue;
      }
      const range = JSON.parse(val.result!);
      if (range.modelExtents) {
        ranges.push(range.modelExtents);
      }
    }
    return ranges;
  }

  public async getModelProps(tokenProps: IModelRpcProps, modelIdsList: Id64String[]): Promise<ModelProps[]> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const modelIds = new Set(modelIdsList);
    const iModelDb: IModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
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
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const elementIds = new Set(elementIdsList);
    const iModelDb: IModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
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
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const props: ElementLoadProps = options ? { ...options } : {};
    if (typeof identifier === "string") {
      if (Id64.isId64(identifier))
        props.id = identifier;
      else
        props.federationGuid = identifier;
    } else {
      props.code = Code.fromJSON(identifier);
    }

    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).elements.tryGetElementProps(props);
  }

  public async getGeometrySummary(tokenProps: IModelRpcProps, request: GeometrySummaryRequestProps): Promise<string> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModel = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    return generateGeometrySummaries(request, iModel);
  }

  public async queryElementProps(tokenProps: IModelRpcProps, params: EntityQueryParams): Promise<ElementProps[]> {
    const ids = await this.queryEntityIds(tokenProps, params);
    const res = this.getElementProps(tokenProps, [...ids]);
    return res;
  }

  public async queryEntityIds(tokenProps: IModelRpcProps, params: EntityQueryParams): Promise<Id64String[]> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const res = (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).queryEntityIds(params);
    return [...res];
  }

  public async getClassHierarchy(tokenProps: IModelRpcProps, classFullName: string): Promise<string[]> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb: IModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
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
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const codeSpecs: any[] = [];
    (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).withPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec", (statement) => {
      for (const row of statement)
        codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });
    });
    Logger.logTrace(loggerCategory, "IModelDbRemoting.getAllCodeSpecs", () => ({ numCodeSpecs: codeSpecs.length }));
    return codeSpecs;
  }

  public async getViewStateData(tokenProps: IModelRpcProps, viewDefinitionId: string, options?: ViewStateLoadProps): Promise<ViewStateProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).views.getViewStateData(viewDefinitionId, options);
  }

  public async readFontJson(tokenProps: IModelRpcProps): Promise<any> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).readFontJson();
  }

  public async requestSnap(tokenProps: IModelRpcProps, sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).requestSnap(requestContext, sessionId, props);
  }

  public async cancelSnap(tokenProps: IModelRpcProps, sessionId: string): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).cancelSnap(sessionId);
  }

  public async getGeometryContainment(tokenProps: IModelRpcProps, props: GeometryContainmentRequestProps): Promise<GeometryContainmentResponseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).getGeometryContainment(requestContext, props);
  }

  public async getMassProperties(tokenProps: IModelRpcProps, props: MassPropertiesRequestProps): Promise<MassPropertiesResponseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).getMassProperties(requestContext, props);
  }

  public async getToolTipMessage(tokenProps: IModelRpcProps, id: string): Promise<string[]> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const el = (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).elements.getElement(id);
    return (el === undefined) ? [] : el.getToolTipMessage();
  }

  /** Send a view thumbnail to the frontend. This is a binary transfer with the metadata in a 16-byte prefix header. */
  public async getViewThumbnail(tokenProps: IModelRpcProps, viewId: string): Promise<Uint8Array> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const thumbnail = (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).views.getThumbnail(viewId);
    if (undefined === thumbnail || 0 === thumbnail.image.length)
      throw new NoContentError();

    const val = new Uint8Array(thumbnail.image.length + 16); // allocate a new buffer 16 bytes larger than the image size
    new Uint32Array(val.buffer, 0, 4).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]);    // Put the metadata in the first 16 bytes.
    val.set(thumbnail.image, 16); // put the image data at offset 16 after metadata
    return val;
  }

  public async getDefaultViewId(tokenProps: IModelRpcProps): Promise<Id64String> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const spec = { namespace: "dgn_View", name: "DefaultView" };
    const blob = (await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion)).queryFilePropertyBlob(spec);
    if (undefined === blob || 8 !== blob.length)
      return Id64.invalid;

    const view = new Uint32Array(blob.buffer);
    return Id64.fromUint32Pair(view[0], view[1]);
  }
  public async getSpatialCategoryId(tokenProps: IModelRpcProps, categoryName: string): Promise<Id64String | undefined> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    const dictionary: DictionaryModel = iModelDb.models.getModel<DictionaryModel>(IModel.dictionaryId);
    return SpatialCategory.queryCategoryIdByName(iModelDb, dictionary.id, categoryName);
  }

  public async getIModelCoordinatesFromGeoCoordinates(tokenProps: IModelRpcProps, props: string): Promise<IModelCoordinatesResponseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    return iModelDb.getIModelCoordinatesFromGeoCoordinates(requestContext, props);
  }

  public async getGeoCoordinatesFromIModelCoordinates(tokenProps: IModelRpcProps, props: string): Promise<GeoCoordinatesResponseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelDb = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    return iModelDb.getGeoCoordinatesFromIModelCoordinates(requestContext, props);
  }

  public async getTextureImage(tokenProps: IModelRpcProps, textureLoadProps: TextureLoadProps): Promise<Uint8Array | undefined> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const db = await RpcBriefcaseUtility.findOrOpen(requestContext, tokenProps, SyncMode.FixedVersion);
    return db.getTextureImage(textureLoadProps);
  }
}
