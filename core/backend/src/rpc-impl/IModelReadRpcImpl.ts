/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus, CompressedId64Set, GuidString, Id64, Id64String, IModelStatus, Logger } from "@itwin/core-bentley";
import {
  Code, CodeProps, CustomViewState3dCreatorOptions, CustomViewState3dProps, DbBlobRequest, DbBlobResponse, DbQueryRequest, DbQueryResponse, ElementLoadOptions, ElementLoadProps,
  ElementProps, EntityMetaData, EntityQueryParams, FontMapProps, GeoCoordinatesRequestProps, GeoCoordinatesResponseProps, GeometryContainmentRequestProps,
  GeometryContainmentResponseProps, GeometrySummaryRequestProps, HydrateViewStateRequestProps, HydrateViewStateResponseProps, ImageSourceFormat, IModel,
  IModelConnectionProps, IModelCoordinatesRequestProps, IModelCoordinatesResponseProps, IModelError, IModelReadRpcInterface, IModelRpcOpenProps,
  IModelRpcProps, MassPropertiesPerCandidateRequestProps, MassPropertiesPerCandidateResponseProps, MassPropertiesRequestProps, MassPropertiesResponseProps, ModelExtentsProps,
  ModelProps, NoContentError, RpcInterface, RpcManager, SnapRequestProps, SnapResponseProps, SubCategoryResultRow, SyncMode, TextureData, TextureLoadProps, ViewStateLoadProps,ViewStateProps,
} from "@itwin/core-common";
import { Range3dProps } from "@itwin/core-geometry";
import { SpatialCategory } from "../Category";
import { ConcurrentQuery } from "../ConcurrentQuery";
import { generateGeometrySummaries } from "../GeometrySummary";
import { DictionaryModel } from "../Model";
import { RpcBriefcaseUtility } from "./RpcBriefcaseUtility";
import { RpcTrace } from "../RpcBackend";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { CustomViewState3dCreator } from "../CustomViewState3dCreator";
import { ViewStateHydrator } from "../ViewStateHydrator";

/** The backend implementation of IModelReadRpcInterface.
 * @internal
 */
export class IModelReadRpcImpl extends RpcInterface implements IModelReadRpcInterface {

  public static register() { RpcManager.registerImpl(IModelReadRpcInterface, IModelReadRpcImpl); }

  public async getConnectionProps(tokenProps: IModelRpcOpenProps): Promise<IModelConnectionProps> {
    return RpcBriefcaseUtility.openWithTimeout(RpcTrace.expectCurrentActivity, tokenProps, SyncMode.FixedVersion);
  }

  public async getCustomViewState3dData(tokenProps: IModelRpcProps, options: CustomViewState3dCreatorOptions): Promise<CustomViewState3dProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const viewCreator = new CustomViewState3dCreator(iModelDb);
    return viewCreator.getCustomViewState3dData(options);
  }

  public async hydrateViewState(tokenProps: IModelRpcProps, options: HydrateViewStateRequestProps): Promise<HydrateViewStateResponseProps> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const viewHydrater = new ViewStateHydrator(iModelDb);
    return viewHydrater.getHydrateResponseProps(options);
  }

  public async querySubCategories(tokenProps: IModelRpcProps, compressedCategoryIds: CompressedId64Set): Promise<SubCategoryResultRow[]> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const decompressedIds = CompressedId64Set.decompressArray(compressedCategoryIds);
    return iModelDb.querySubCategories(decompressedIds);
  }

  public async queryRows(tokenProps: IModelRpcProps, request: DbQueryRequest): Promise<DbQueryResponse> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    if (iModelDb.isReadonly && request.usePrimaryConn === true) {
      Logger.logWarning(BackendLoggerCategory.IModelDb, "usePrimaryConn is only supported on imodel that is opened in read/write mode. The option will be ignored.", request);
      request.usePrimaryConn = false;
    }
    return ConcurrentQuery.executeQueryRequest(iModelDb.nativeDb, request);
  }

  public async queryBlob(tokenProps: IModelRpcProps, request: DbBlobRequest): Promise<DbBlobResponse> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    if (iModelDb.isReadonly && request.usePrimaryConn === true) {
      Logger.logWarning(BackendLoggerCategory.IModelDb, "usePrimaryConn is only supported on imodel that is opened in read/write mode. The option will be ignored.", request);
      request.usePrimaryConn = false;
    }
    return ConcurrentQuery.executeBlobRequest(iModelDb.nativeDb, request);
  }

  public async queryModelRanges(tokenProps: IModelRpcProps, modelIds: Id64String[]): Promise<Range3dProps[]> {
    const results = await this.queryModelExtents(tokenProps, modelIds);
    if (results.length === 1 && results[0].status !== IModelStatus.Success)
      throw new IModelError(results[0].status, "error querying model range");

    return results.filter((x) => x.status === IModelStatus.Success).map((x) => x.extents);
  }

  public async queryModelExtents(tokenProps: IModelRpcProps, modelIds: Id64String[]): Promise<ModelExtentsProps[]> {
    const iModel = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    return iModel.models.queryExtents(modelIds);
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
    return iModelDb.views.getViewStateProps(viewDefinitionId, options);
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

  public async getMassPropertiesPerCandidate(tokenProps: IModelRpcProps, props: MassPropertiesPerCandidateRequestProps): Promise<MassPropertiesPerCandidateResponseProps[]> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);

    const getSingleCandidateMassProperties = async (candidate: string) => {
      try {
        const massPropResults: MassPropertiesResponseProps[] = [];

        for (const op of props.operations) {
          const massProperties = await iModelDb.getMassProperties({ operation: op, candidates: [candidate] });
          massPropResults.push(massProperties);
        }

        let singleCandidateResult: MassPropertiesPerCandidateResponseProps = { status: BentleyStatus.ERROR, candidate };

        if (massPropResults.some((r) => r.status !== BentleyStatus.ERROR)) {
          singleCandidateResult.status = BentleyStatus.SUCCESS;
          for (const r of massPropResults.filter((mpr) => mpr.status !== BentleyStatus.ERROR)) {
            singleCandidateResult = { ...singleCandidateResult, ...r };
          }
        }

        return singleCandidateResult;
      } catch {
        return { status: BentleyStatus.ERROR, candidate };
      }
    };

    const promises: Promise<MassPropertiesPerCandidateResponseProps>[] = [];

    for (const candidate of CompressedId64Set.iterable(props.candidates)) {
      promises.push(getSingleCandidateMassProperties(candidate));
    }

    return Promise.all(promises);
  }

  public async getToolTipMessage(tokenProps: IModelRpcProps, id: string): Promise<string[]> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, tokenProps);
    const el = iModelDb.elements.getElement(id);
    return (el === undefined) ? [] : el.getToolTipMessage();
  }

  /** Send a view thumbnail to the frontend. This is a binary transfer with the metadata in a 16-byte prefix header.
   * @deprecated
   */
  public async getViewThumbnail(_tokenProps: IModelRpcProps, _viewId: string): Promise<Uint8Array> {
    const iModelDb = await RpcBriefcaseUtility.findOpenIModel(RpcTrace.expectCurrentActivity.accessToken, _tokenProps);
    const thumbnail = iModelDb.views.getThumbnail(_viewId);
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
