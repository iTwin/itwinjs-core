/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { ClientRequestContext, assert, Id64, Id64String, Logger, OpenMode, IModelStatus } from "@bentley/bentleyjs-core";
import { Range3dProps, Range3d } from "@bentley/geometry-core";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import {
  ElementProps, EntityMetaData, EntityQueryParams, GeoCoordinatesResponseProps, ImageSourceFormat, IModelProps,
  IModelCoordinatesResponseProps, IModelReadRpcInterface, IModelToken, IModelTokenProps, ModelProps, RpcInterface, RpcManager,
  SnapRequestProps, SnapResponseProps, ViewStateProps, IModel, IModelVersion, QueryLimit, QueryQuota, QueryResponse, QueryPriority,
} from "@bentley/imodeljs-common";
import { KeepBriefcase } from "../BriefcaseManager";
import { SpatialCategory } from "../Category";
import { IModelDb, OpenParams } from "../IModelDb";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { DictionaryModel } from "../Model";

const loggerCategory: string = BackendLoggerCategory.IModelDb;

/** The backend implementation of IModelReadRpcInterface.
 * @internal
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async openForRead(tokenProps: IModelTokenProps): Promise<IModelProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const openParams: OpenParams = OpenParams.fixedVersion();
    openParams.timeout = 1000; // 1 second
    const iModelVersion = IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const db = await IModelDb.open(requestContext, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);
    return db.toJSON();
  }

  public async close(tokenProps: IModelTokenProps): Promise<boolean> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelToken = IModelToken.fromJSON(tokenProps);
    await IModelDb.find(iModelToken).close(requestContext, iModelToken.openMode === OpenMode.Readonly ? KeepBriefcase.Yes : KeepBriefcase.No);
    return Promise.resolve(true);
  }

  public async queryRows(tokenProps: IModelTokenProps, ecsql: string, bindings?: any[] | object, limit?: QueryLimit, quota?: QueryQuota, priority?: QueryPriority): Promise<QueryResponse> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    return iModelDb.queryRows(ecsql, bindings, limit, quota, priority);
  }

  public async queryModelRanges(tokenProps: IModelTokenProps, modelIdsList: Id64String[]): Promise<Range3dProps[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const modelIds = new Set(modelIdsList);
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
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
      }
      const range = JSON.parse(val.result!);
      if (range.modelExtents) {
        ranges.push(range.modelExtents);
      }
    }
    return ranges;
  }

  public async getModelProps(tokenProps: IModelTokenProps, modelIdsList: Id64String[]): Promise<ModelProps[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const modelIds = new Set(modelIdsList);
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const modelJsonArray: ModelProps[] = [];
    for (const id of modelIds) {
      try {
        // TODO: Change iModelDbModels.getModelJson to return a ModelProps object, rather than a string.
        const modelProps: any = JSON.parse(iModelDb.models.getModelJson(JSON.stringify({ id })));
        assert("modeledElement" in modelProps, "iModelDb.models.getModelJson must return a ModelProps object");
        modelJsonArray.push(modelProps);
      } catch (error) {
        if (modelIds.size === 1)
          throw error; // if they're asking for more than one model, don't throw on error.
      }
    }
    return modelJsonArray;
  }

  public async queryModelProps(tokenProps: IModelTokenProps, params: EntityQueryParams): Promise<ModelProps[]> {
    const ids = await this.queryEntityIds(tokenProps, params);
    return this.getModelProps(tokenProps, [...ids]);
  }

  public async getElementProps(tokenProps: IModelTokenProps, elementIdsList: Id64String[]): Promise<ElementProps[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const elementIds = new Set(elementIdsList);
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
    const elementProps: ElementProps[] = [];
    for (const id of elementIds) {
      try {
        elementProps.push(iModelDb.elements.getElementJson(JSON.stringify({ id })));
      } catch (error) {
        if (elementIds.size === 1)
          throw error; // if they're asking for more than one element, don't throw on error.
      }
    }
    return elementProps;
  }

  public async queryElementProps(tokenProps: IModelTokenProps, params: EntityQueryParams): Promise<ElementProps[]> {
    const ids = await this.queryEntityIds(tokenProps, params);
    const res = this.getElementProps(tokenProps, [...ids]);
    return res;
  }

  public async queryEntityIds(tokenProps: IModelTokenProps, params: EntityQueryParams): Promise<Id64String[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const res = IModelDb.find(iModelToken).queryEntityIds(params);
    return [...res];
  }

  public async getClassHierarchy(tokenProps: IModelTokenProps, classFullName: string): Promise<string[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModelDb: IModelDb = IModelDb.find(iModelToken);
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

  public async getAllCodeSpecs(tokenProps: IModelTokenProps): Promise<any[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const codeSpecs: any[] = [];
    IModelDb.find(iModelToken).withPreparedStatement("SELECT ECInstanceId AS id, name, jsonProperties FROM BisCore.CodeSpec", (statement) => {
      for (const row of statement)
        codeSpecs.push({ id: row.id, name: row.name, jsonProperties: JSON.parse(row.jsonProperties) });
    });
    Logger.logTrace(loggerCategory, "IModelDbRemoting.getAllCodeSpecs", () => ({ numCodeSpecs: codeSpecs.length }));
    return codeSpecs;
  }

  public async getViewStateData(tokenProps: IModelTokenProps, viewDefinitionId: string): Promise<ViewStateProps> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return IModelDb.find(iModelToken).views.getViewStateData(viewDefinitionId);
  }

  public async readFontJson(tokenProps: IModelTokenProps): Promise<any> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return IModelDb.find(iModelToken).readFontJson();
  }

  public async requestSnap(tokenProps: IModelTokenProps, sessionId: string, props: SnapRequestProps): Promise<SnapResponseProps> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const requestContext = ClientRequestContext.current;
    return IModelDb.find(iModelToken).requestSnap(requestContext, sessionId, props);
  }

  public async cancelSnap(tokenProps: IModelTokenProps, sessionId: string): Promise<void> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    return IModelDb.find(iModelToken).cancelSnap(sessionId);
  }

  public async getToolTipMessage(tokenProps: IModelTokenProps, id: string): Promise<string[]> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const el = IModelDb.find(iModelToken).elements.getElement(id);
    return (el === undefined) ? [] : el.getToolTipMessage();
  }

  /** Send a view thumbnail to the frontend. This is a binary transfer with the metadata in an 8-byte prefix header. */
  public async getViewThumbnail(tokenProps: IModelTokenProps, viewId: string): Promise<Uint8Array> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const thumbnail = IModelDb.find(iModelToken).views.getThumbnail(viewId);
    if (undefined === thumbnail || 0 === thumbnail.image.length)
      return Promise.reject(new Error("no thumbnail"));

    const val = new Uint8Array(thumbnail.image.length + 8); // allocate a new buffer 8 bytes larger than the image size
    new Uint16Array(val.buffer).set([thumbnail.image.length, thumbnail.format === "jpeg" ? ImageSourceFormat.Jpeg : ImageSourceFormat.Png, thumbnail.width, thumbnail.height]);    // Put the metadata in the first 8 bytes.
    new Uint8Array(val.buffer, 8).set(thumbnail.image); // put the image data at offset 8 after metadata
    return val;
  }

  public async getDefaultViewId(tokenProps: IModelTokenProps): Promise<Id64String> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const spec = { namespace: "dgn_View", name: "DefaultView" };
    const blob = IModelDb.find(iModelToken).queryFilePropertyBlob(spec);
    if (undefined === blob || 8 !== blob.length)
      return Id64.invalid;

    const view = new Uint32Array(blob.buffer);
    return Id64.fromUint32Pair(view[0], view[1]);
  }
  public async getSpatialCategoryId(tokenProps: IModelTokenProps, categoryName: string): Promise<Id64String | undefined> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModelDb = IModelDb.find(iModelToken);
    const dictionary: DictionaryModel = iModelDb.models.getModel(IModel.dictionaryId) as DictionaryModel;
    return SpatialCategory.queryCategoryIdByName(iModelDb, dictionary.id, categoryName);
  }

  public async getIModelCoordinatesFromGeoCoordinates(tokenProps: IModelTokenProps, props: string): Promise<IModelCoordinatesResponseProps> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModelDb = IModelDb.find(iModelToken);
    const requestContext = ClientRequestContext.current;
    return iModelDb.getIModelCoordinatesFromGeoCoordinates(requestContext, props);
  }

  public async getGeoCoordinatesFromIModelCoordinates(tokenProps: IModelTokenProps, props: string): Promise<GeoCoordinatesResponseProps> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const iModelDb = IModelDb.find(iModelToken);
    const requestContext = ClientRequestContext.current;
    return iModelDb.getGeoCoordinatesFromIModelCoordinates(requestContext, props);
  }
}
