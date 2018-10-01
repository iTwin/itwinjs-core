/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module iModelHub */

import { ECJsonTypeMap, WsgInstance, GuidSerializer } from "./../ECJsonTypeMap";

import { request, RequestOptions } from "./../Request";
import { AccessToken } from "../Token";
import { Logger, ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { ArgumentCheck } from "./Errors";
import { InstanceIdQuery } from "./Query";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Thumbnail size. 'Small' is 400x250 PNG image and 'Large' is a 800x500 PNG image. */
export type ThumbnailSize = "Small" | "Large";

/** Base class for Thumbnails. */
export abstract class Thumbnail extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "instanceId", new GuidSerializer())
  public id?: Guid;
}

/** Small [[Thumbnail]] class. Small Thumbnail is a 400x250 PNG image. */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.SmallThumbnail", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class SmallThumbnail extends Thumbnail { }
/** Large [[Thumbnail]] class. Large Thumbnail is a 800x500 PNG image. */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.LargeThumbnail", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class LargeThumbnail extends Thumbnail { }

/** Tip [[Thumbnail]] download parameters. See [[ThumbnailHandler.download]]. Tip Thumbnail is generated for the periodically updated master file copy on iModelHub. */
export interface TipThumbnail {
  /** Id of the iModel's [[Project]]. */
  projectId: string;
  /** Size of the [[Thumbnail]]. */
  size: ThumbnailSize;
}

/**
 * Query object for getting [[Thumbnail]]s. You can use this to modify the [[ThumbnailHandler.get]] results.
 */
export class ThumbnailQuery extends InstanceIdQuery {
  /**
   * Query [[Thumbnail]]s by [[Version]] id.
   * @param versionId Id of the version.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if versionId is undefined or it is not a valid [Guid]($bentley) value.
   */
  public byVersionId(versionId: Guid) {
    ArgumentCheck.validGuid("versionId", versionId);
    this.addFilter(`HasThumbnail-backward-Version.Id+eq+'${versionId}'`);
    return this;
  }
}

/**
 * Handler for retrieving [[Thumbnail]]s. Use [[IModelClient.Thumbnails]] to get an instance of this class.
 */
export class ThumbnailHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for ThumbnailHandler.
   * @hidden
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Get relative url for tip Thumbnail requests.
   * @hidden
   * @param projectId Id of the [[Project]].
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail.
   */
  private getRelativeProjectUrl(projectId: string, imodelId: Guid, size: ThumbnailSize) {
    return `/Repositories/Project--${this._handler.formatProjectIdForUrl(projectId)}/ProjectScope/${size}Thumbnail/${imodelId.toString()}/$file`;
  }

  /**
   * Get relative url for Thumbnail requests.
   * @hidden
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail.
   * @param thumbnailId Id of the thumbnail.
   */
  private getRelativeUrl(imodelId: Guid, size: ThumbnailSize, thumbnailId?: Guid) {
    return `/Repositories/iModel--${imodelId}/iModelScope/${size}Thumbnail/${thumbnailId || ""}`;
  }

  /**
   * Check if given thumbnail is TipThumbnail.
   * @hidden
   * @param thumbnail SmallThumbnail, LargeThumbnail or TipThumbnail.
   */
  private isTipThumbnail(thumbnail: Thumbnail | TipThumbnail): thumbnail is TipThumbnail {
    return (thumbnail as TipThumbnail).projectId !== undefined;
  }

  /**
   * Download the thumbnail.
   * @hidden
   * @param token Delegation token of the authorized user.
   * @param url Url to download thumbnail.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes.
   */
  private async downloadThumbnail(alctx: ActivityLoggingContext, token: AccessToken, url: string): Promise<string> {
    alctx.enter();
    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: token.toTokenString() },
      responseType: "arraybuffer",
      agent: this._handler.getAgent(),
    };

    const response = await request(alctx, url, options);
    alctx.enter();

    const byteArray = new Uint8Array(response.body);
    if (!byteArray || byteArray.length === 0) {
      return Promise.reject(new Error("Expected an image to be returned from the query"));
    }

    const base64Data = Base64.btoa(String.fromCharCode.apply(null, byteArray));
    return "data:image/png;base64," + base64Data;
  }

  /**
   * Download the latest iModel's thumbnail.
   * @hidden
   * @param token Delegation token of the authorized user.
   * @param projectId Id of the connect project.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail. Pass 'Small' for 400x250 PNG image, and 'Large' for a 800x500 PNG image.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes.
   */
  private async downloadTipThumbnail(alctx: ActivityLoggingContext, token: AccessToken, projectId: string, imodelId: Guid, size: ThumbnailSize): Promise<string> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Downloading tip ${size}Thumbnail for iModel ${imodelId}`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("projectId", projectId);
    ArgumentCheck.validGuid("imodelId", imodelId);

    const url: string = await this._handler.getUrl(alctx) + this.getRelativeProjectUrl(projectId, imodelId, size);
    const pngImage = await this.downloadThumbnail(alctx, token, url);
    alctx.enter();

    Logger.logTrace(loggingCategory, `Downloaded tip ${size}Thumbnail for iModel ${imodelId}`);

    return pngImage;
  }

  /**
   * Get the [[Thumbnail]]s. Returned Thumbnails are ordered from the latest [[ChangeSet]] to the oldest.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail.
   * @param query Optional query object to filter the queried Thumbnails.
   * @return Array of Thumbnails of the specified size that match the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, size: ThumbnailSize, query: ThumbnailQuery = new ThumbnailQuery()): Promise<Thumbnail[]> {
    alctx.enter();
    Logger.logInfo(loggingCategory, `Querying iModel ${imodelId} thumbnails`);
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    let thumbnails = [];
    if (size === "Small")
      thumbnails = await this._handler.getInstances<SmallThumbnail>(alctx, SmallThumbnail, token, this.getRelativeUrl(imodelId, size, query.getId()), query.getQueryOptions());
    else
      thumbnails = await this._handler.getInstances<LargeThumbnail>(alctx, LargeThumbnail, token, this.getRelativeUrl(imodelId, size, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried iModel ${imodelId} thumbnails`);

    return thumbnails;
  }

  /**
   * Download a [[Thumbnail]].
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel. See [[HubIModel]].
   * @param thumbnail Small, Large or Tip thumbnail. Use [[ThumbnailHandler.get]] to get a [[SmallThumbnail]] or [[LargeThumbnail]] instance or provide Tip thumbnail information by constructing a [[TipThumbnail]] instance.
   * @return Base64 encoded string containing the PNG image.
   * @throws Error if a successful server response contains no content.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[ResponseError]] if a network issue occurs.
   */
  public async download(alctx: ActivityLoggingContext, token: AccessToken, imodelId: Guid, thumbnail: Thumbnail | TipThumbnail): Promise<string> {
    alctx.enter();
    ArgumentCheck.defined("token", token);
    ArgumentCheck.validGuid("imodelId", imodelId);

    if (this.isTipThumbnail(thumbnail)) {
      return await this.downloadTipThumbnail(alctx, token, thumbnail.projectId, imodelId, thumbnail.size);
    }

    const size: ThumbnailSize = thumbnail instanceof SmallThumbnail ? "Small" : "Large";
    const thumbnailId: Guid = thumbnail.id!;

    Logger.logInfo(loggingCategory, `Downloading ${size}Thumbnail ${thumbnailId} for iModel ${imodelId}`);

    const url: string = await this._handler.getUrl(alctx) + this.getRelativeUrl(imodelId, size, thumbnailId) + "/$file";
    const pngImage = await this.downloadThumbnail(alctx, token, url);
    alctx.enter();
    Logger.logTrace(loggingCategory, `Downloaded ${size}Thumbnail ${thumbnailId} for iModel ${imodelId}`);

    return pngImage;
  }
}
