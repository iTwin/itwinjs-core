/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModelHubClient
 */

import { AccessToken, GuidString, Logger } from "@itwin/core-bentley";
import { request, RequestOptions } from "@bentley/itwin-client";
import { ECJsonTypeMap, WsgInstance } from "../wsg/ECJsonTypeMap";
import { Base64 } from "js-base64";
import { IModelHubClientLoggerCategory } from "../IModelHubClientLoggerCategories";
import { IModelBaseHandler } from "./BaseHandler";
import { ArgumentCheck } from "./Errors";
import { InstanceIdQuery } from "./HubQuery";

const loggerCategory: string = IModelHubClientLoggerCategory.IModelHub;

/** Thumbnail size. 'Small' is 400x250 PNG image and 'Large' is a 800x500 PNG image.
 * @public
 */
export type ThumbnailSize = "Small" | "Large";

/** Base class for Thumbnails.
 * @internal
 */
export abstract class Thumbnail extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "instanceId")
  public id?: GuidString;
}

/** Small [[Thumbnail]] class. Small Thumbnail is a 400x250 PNG image.
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.SmallThumbnail", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class SmallThumbnail extends Thumbnail { }

/** Large [[Thumbnail]] class. Large Thumbnail is a 800x500 PNG image.
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "iModelScope.LargeThumbnail", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class LargeThumbnail extends Thumbnail { }

/** Tip [[Thumbnail]] download parameters. See [[ThumbnailHandler.download]]. Tip Thumbnail is generated for the periodically updated master file copy on iModelHub.
 * @public
 */
export interface TipThumbnail {
  /** Id of the iModel's parent iTwin. */
  iTwinId: string;
  /** Size of the [[Thumbnail]]. */
  size: ThumbnailSize;
}

/**
 * Query object for getting [[Thumbnail]]s. You can use this to modify the [[ThumbnailHandler.get]] results.
 * @internal
 */
export class ThumbnailQuery extends InstanceIdQuery {
  /**
   * Query [[Thumbnail]]s by [[Version]] id.
   * @param versionId Id of the version.
   * @returns This query.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if versionId is undefined or it is not a valid [GuidString]($bentley) value.
   * @internal @deprecated
   */
  public byVersionId(versionId: GuidString) {
    ArgumentCheck.validGuid("versionId", versionId);
    this.addFilter(`HasThumbnail-backward-Version.Id+eq+'${versionId}'`);
    return this;
  }
}

/**
 * Handler for retrieving [[Thumbnail]]s. Use [[IModelClient.Thumbnails]] to get an instance of this class.
 * @internal
 */
export class ThumbnailHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for ThumbnailHandler.
   * @param handler Handler for WSG requests.
   * @internal
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /** Get relative url for tip Thumbnail requests.
   * @param iTwinId Id of the iModel's parent iTwin.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail.
   */
  private getRelativeContextUrl(iTwinId: string, iModelId: GuidString, size: ThumbnailSize) {
    return `/Repositories/Context--${this._handler.formatITwinIdForUrl(iTwinId)}/ContextScope/${size}Thumbnail/${iModelId.toString()}/$file`;
  }

  /** Get relative url for Thumbnail requests.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail.
   * @param thumbnailId Id of the thumbnail.
   */
  private getRelativeUrl(iModelId: GuidString, size: ThumbnailSize, thumbnailId?: GuidString) {
    return `/Repositories/iModel--${iModelId}/iModelScope/${size}Thumbnail/${thumbnailId || ""}`;
  }

  /** Check if given thumbnail is TipThumbnail.
   * @param thumbnail SmallThumbnail, LargeThumbnail or TipThumbnail.
   */
  private isTipThumbnail(thumbnail: Thumbnail | TipThumbnail): thumbnail is TipThumbnail {
    return (thumbnail as TipThumbnail).iTwinId !== undefined;
  }

  /** Download the thumbnail.
   * @param url Url to download thumbnail.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes
   */
  private async downloadThumbnail(accessToken: AccessToken, url: string): Promise<string> {
    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessToken },
      responseType: "arraybuffer",
      agent: this._handler.getAgent(),
    };

    const response = await request(url, options);

    const byteArray = new Uint8Array(response.body);
    if (!byteArray || byteArray.length === 0) {
      throw new Error("Expected an image to be returned from the query");
    }

    const base64Data = Base64.btoa(byteArray.reduce((acc, byte) => acc + String.fromCharCode(byte), ""));
    return `data:image/png;base64,${base64Data}`;

  }

  /** Download the latest iModel's thumbnail.
   * @param iTwinId Id of the iModel's parent iTwin.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail. Pass 'Small' for 400x250 PNG image, and 'Large' for a 800x500 PNG image.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes.
   */
  private async downloadTipThumbnail(accessToken: AccessToken, iTwinId: string, iModelId: GuidString, size: ThumbnailSize): Promise<string> {
    Logger.logInfo(loggerCategory, `Downloading tip ${size}Thumbnail`, () => ({ iModelId }));
    ArgumentCheck.validGuid("iTwinId", iTwinId);
    ArgumentCheck.validGuid("iModelId", iModelId);

    const url: string = await this._handler.getUrl() + this.getRelativeContextUrl(iTwinId, iModelId, size);
    const pngImage = await this.downloadThumbnail(accessToken, url);

    Logger.logTrace(loggerCategory, `Downloaded tip ${size}Thumbnail`, () => ({ iModelId }));
    return pngImage;
  }

  /** Get the [[Thumbnail]]s. Returned Thumbnails are ordered from the latest [[ChangeSet]] to the oldest.
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param size Size of the thumbnail.
   * @param query Optional query object to filter the queried Thumbnails.
   * @return Array of Thumbnails of the specified size that match the query.
   * @throws [Common iModelHub errors]($docs/learning/iModelHub/CommonErrors)
   */
  public async get(accessToken: AccessToken, iModelId: GuidString, size: ThumbnailSize, query: ThumbnailQuery = new ThumbnailQuery()): Promise<Thumbnail[]> {
    Logger.logInfo(loggerCategory, "Querying iModel thumbnails", () => ({ iModelId }));
    ArgumentCheck.validGuid("iModelId", iModelId);

    let thumbnails = [];
    if (size === "Small")
      thumbnails = await this._handler.getInstances<SmallThumbnail>(accessToken, SmallThumbnail, this.getRelativeUrl(iModelId, size, query.getId()), query.getQueryOptions());
    else
      thumbnails = await this._handler.getInstances<LargeThumbnail>(accessToken, LargeThumbnail, this.getRelativeUrl(iModelId, size, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggerCategory, "Queried iModel thumbnails", () => ({ iModelId }));
    return thumbnails;
  }

  /** Download a [[Thumbnail]].
   * @param iModelId Id of the iModel. See [[HubIModel]].
   * @param thumbnail Small, Large or Tip thumbnail. Use [[ThumbnailHandler.get]] to get a [[SmallThumbnail]] or [[LargeThumbnail]] instance or provide Tip thumbnail information by constructing a [[TipThumbnail]] instance.
   * @return Base64 encoded string containing the PNG image.
   * @throws Error if a successful server response contains no content.
   * @throws [[IModelHubClientError]] with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the arguments is undefined or has an invalid value.
   * @throws [[ResponseError]] if a network issue occurs.
   */
  public async download(accessToken: AccessToken, iModelId: GuidString, thumbnail: Thumbnail | TipThumbnail): Promise<string> {
    ArgumentCheck.validGuid("iModelId", iModelId);

    if (this.isTipThumbnail(thumbnail)) {
      return this.downloadTipThumbnail(accessToken, thumbnail.iTwinId, iModelId, thumbnail.size);
    }

    const size: ThumbnailSize = thumbnail instanceof SmallThumbnail ? "Small" : "Large";
    const thumbnailId: GuidString = thumbnail.id!;

    Logger.logInfo(loggerCategory, `Downloading ${size}Thumbnail ${thumbnailId} for iModel`, () => ({ iModelId }));

    const url: string = `${await this._handler.getUrl() + this.getRelativeUrl(iModelId, size, thumbnailId)}/$file`;
    const pngImage = await this.downloadThumbnail(accessToken, url);
    Logger.logTrace(loggerCategory, `Downloaded ${size}Thumbnail ${thumbnailId} for iModel`, () => ({ iModelId }));
    return pngImage;
  }
}
