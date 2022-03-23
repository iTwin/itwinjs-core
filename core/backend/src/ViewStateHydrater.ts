/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, CompressedId64Set, Id64String, Logger } from "@itwin/core-bentley";
import { HydrateViewStateRequestProps, HydrateViewStateResponseProps, ModelProps, QueryRowFormat, SubCategoryResultRow, ViewAttachmentProps, ViewStateLoadProps } from "@itwin/core-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { IModelDb } from "./IModelDb";

export class ViewStateHydrater {
  private _imodel: IModelDb;
  public constructor(iModel: IModelDb) {
    this._imodel = iModel;
  }

  public async getHydrateResponseProps(options: HydrateViewStateRequestProps): Promise<HydrateViewStateResponseProps> {
    const response: HydrateViewStateResponseProps = {};
    const promises = [];
    if (options.acsId)
      promises.push(this.handleAcsId(response, options.acsId));
    if (options.sheetViewAttachmentIds)
      promises.push(this.handleSheetViewAttachmentIds(response, options.sheetViewAttachmentIds, options.viewStateLoadProps));
    if (options.notLoadedCategoryIds)
      promises.push(this.handleCategoryIds(response, options.notLoadedCategoryIds));
    if (options.spatialViewId)
      promises.push(this.handleSpatialViewId(response, options.spatialViewId, options.viewStateLoadProps));
    if (options.notLoadedModelSelectorStateModels)
      promises.push(this.handleModelSelectorStateModels(response, options.notLoadedModelSelectorStateModels));
    if (options.baseModelId)
      promises.push(this.handleBaseModelId(response, options.baseModelId));
    await Promise.all(promises);
    return response;
  }

  private async handleBaseModelId(response: HydrateViewStateResponseProps, baseModelId: Id64String) {
    let modelProps;
    try {
      modelProps = this._imodel.models.getModelJson({ id: baseModelId });
    } catch (err) {
      Logger.logError(BackendLoggerCategory.ViewStateHydrater, `Error getting modelProps for baseModelId: ${baseModelId}`, () => ({error: BentleyError.getErrorProps(err)}));
    }
    response.baseModelProps = modelProps;
  }

  private async handleModelSelectorStateModels(response: HydrateViewStateResponseProps, models: CompressedId64Set) {
    const decompressedModelIds = CompressedId64Set.decompressSet(models);

    const modelJsonArray: ModelProps[] = [];
    for (const id of decompressedModelIds) {
      try {
        const modelProps = this._imodel.models.getModelJson({ id });
        modelJsonArray.push(modelProps);
      } catch (error) {
      }
    }

    response.modelSelectorStateModels = modelJsonArray;
  }

  private async handleSpatialViewId(response: HydrateViewStateResponseProps, spatialViewId: Id64String, viewStateLoadProps?: ViewStateLoadProps) {
    response.spatialViewProps = this._imodel.views.getViewStateData(spatialViewId, viewStateLoadProps);
  }

  private async handleCategoryIds(response: HydrateViewStateResponseProps, categoryIds: CompressedId64Set) {
    // consider splitting up categoryIds, as queries get slow with many many categoryids in them.
    const maxCategoriesPerQuery = 200;
    const decompressedIds = CompressedId64Set.decompressArray(categoryIds);
    const result = [];
    while (decompressedIds.length !== 0) {
      const end = (decompressedIds.length > maxCategoriesPerQuery) ? maxCategoriesPerQuery : decompressedIds.length;
      const where = decompressedIds.splice(0, end).join(",");
      const query = `SELECT ECInstanceId as id, Parent.Id as parentId, Properties as appearance FROM BisCore.SubCategory WHERE Parent.Id IN (${where})`;
      try {
        for await (const row of this._imodel.query(query, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
          result.push(row as SubCategoryResultRow);
        }
      } catch {
        // ###TODO: detect cases in which retry is warranted
        // Note that currently, if we succeed in obtaining some pages of results and fail to retrieve another page, we will end up processing the
        // incomplete results. Since we're not retrying, that's the best we can do.
      }
    }
    response.categoryIdsResult = result;
  }

  private async handleAcsId(response: HydrateViewStateResponseProps, acsId: string) {
    try {
      const props = this._imodel.elements.getElementProps(acsId);
      response.acsElementProps = props;
    } catch { }
  }

  private async handleSheetViewAttachmentIds(response: HydrateViewStateResponseProps, sheetViewAttachmentIds: CompressedId64Set, viewStateLoadProps?: ViewStateLoadProps) {
    const decompressedIds = CompressedId64Set.decompressSet(sheetViewAttachmentIds);
    const attachmentProps: ViewAttachmentProps[] = [];
    for (const id of decompressedIds) {
      try {
        attachmentProps.push(this._imodel.elements.getElementJson({ id }) );
      } catch (error) {
      }
    }

    const promises = [];
    for (const attachment of attachmentProps) {
      const loadView = async () => {
        try {
          const view = this._imodel.views.getViewStateData(attachment.view.id, viewStateLoadProps);
          return view;
        } catch {
          return undefined;
        }
      };

      promises.push(loadView());
    }
    const views = await Promise.all(promises);
    response.sheetViewViews = views;
    response.sheetViewAttachmentProps = attachmentProps;

    return;
  }

}
