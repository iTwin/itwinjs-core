/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ECJsonTypeMap, WsgInstance } from "./../ECJsonTypeMap";

import { request, RequestOptions } from "./../Request";
import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";
import { InstanceIdQuery } from "./Query";
import { IModelBaseHandler } from "./BaseHandler";

const loggingCategory = "imodeljs-clients.imodelhub";

/** Thumbnail size. 'Small' is 400x250 PNG image and 'Large' is a 800x500 PNG image */
export type ThumbnailSize = "Small" | "Large";

/** Thumbnail */
export abstract class Thumbnail extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "workaround.to.add.class.to.map")
  public workaround?: string;
}
@ECJsonTypeMap.classToJson("wsg", "iModelScope.SmallThumbnail", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class SmallThumbnail extends Thumbnail { }
@ECJsonTypeMap.classToJson("wsg", "iModelScope.LargeThumbnail", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class LargeThumbnail extends Thumbnail { }

/** Tip Thumbnail download parameters */
export interface TipThumbnail {
  projectId: string;
  size: ThumbnailSize;
}

/**
 * Query object for getting Thumbnails. You can use this to modify the query.
 * @see ThumbnailHandler.get()
 */
export class ThumbnailQuery extends InstanceIdQuery {
  /**
   * Query thumbnails by version id.
   * @param versionId Id of the version.
   * @returns This query.
   */
  public byVersionId(versionId: string) {
    this.addFilter(`HasThumbnail-backward-Version.Id+eq+'${versionId}'`);
    return this;
  }
}

/**
 * Handler for all methods related to thumbnails.
 */
export class ThumbnailHandler {
  private _handler: IModelBaseHandler;

  /**
   * Constructor for ThumbnailHandler. Should use @see IModelClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for tip Thumbnail requests.
   * @param projectId Id of the project.
   * @param imodelId Id of the imodel.
   * @param size Size of the thumbnail.
   */
  private getRelativeProjectUrl(projectId: string, imodelId: string, size: ThumbnailSize) {
    return `/Repositories/Project--${this._handler.formatProjectIdForUrl(projectId)}/ProjectScope/${size}Thumbnail/${imodelId}/$file`;
  }

  /**
   * Gets relative url for Thumbnail requests.
   * @param imodelId Id of the iModel.
   * @param size Size of the thumbnail.
   * @param thumbnailId Id of the thumbnail.
   */
  private getRelativeUrl(imodelId: string, size: ThumbnailSize, thumbnailId?: string) {
    return `/Repositories/iModel--${imodelId}/iModelScope/${size}Thumbnail/${thumbnailId || ""}`;
  }

  /**
   * Returns true if given thumbnail is TipThumbnail.
   * @param thumbnail SmallThumbnail, LargeThumbnail or TipThumbnail.
   */
  private isTipThumbnail(thumbnail: Thumbnail | TipThumbnail): thumbnail is TipThumbnail {
    return (thumbnail as TipThumbnail).projectId !== undefined;
  }

  /**
   * Downloads the thumbnail.
   * @param token Delegation token of the authorized user.
   * @param url Url to download thumbnail.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes.
   */
  private async downloadThumbnail(token: AccessToken, url: string): Promise<string> {
    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: token.toTokenString() },
      responseType: "arraybuffer",
      agent: this._handler.getAgent(),
    };

    const response = await request(url, options);

    const byteArray = new Uint8Array(response.body);
    if (!byteArray || byteArray.length === 0) {
      return Promise.reject(new Error("Expected an image to be returned from the query"));
    }

    const base64Data = Base64.btoa(String.fromCharCode.apply(null, byteArray));
    return "data:image/png;base64," + base64Data;
  }

  /**
   * Downloads the most latest iModel's thumbnail.
   * @param token Delegation token of the authorized user.
   * @param projectId Id of the connect project.
   * @param imodelId Id of the iModel
   * @param size Size of the thumbnail. Pass 'Small' for 400x250 PNG image, and 'Large' for a 800x500 PNG image.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes.
   */
  private async downloadTipThumbnail(token: AccessToken, projectId: string, imodelId: string, size: ThumbnailSize): Promise<string> {
    Logger.logInfo(loggingCategory, `Downloading tip ${size}Thumbnail for iModel ${imodelId}`);

    const url: string = await this._handler.getUrl() + this.getRelativeProjectUrl(projectId, imodelId, size);
    const pngImage = await this.downloadThumbnail(token, url);

    Logger.logTrace(loggingCategory, `Downloaded tip ${size}Thumbnail for iModel ${imodelId}`);

    return pngImage;
  }

  /**
   * Gets the thumbnails.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel
   * @param size Size of the thumbnail. Pass 'Small' for 400x250 PNG image, and 'Large' for a 800x500 PNG image.
   * @param query Optional query object to filter the queried thumbnails.
   * @return Resolves to array of thumbnails.
   */
  public async get(token: AccessToken, imodelId: string, size: ThumbnailSize, query: ThumbnailQuery = new ThumbnailQuery()): Promise<Thumbnail[]> {
    Logger.logInfo(loggingCategory, `Querying iModel ${imodelId} thumbnails`);

    let thumbnails = [];
    if (size === "Small")
      thumbnails = await this._handler.getInstances<SmallThumbnail>(SmallThumbnail, token, this.getRelativeUrl(imodelId, size, query.getId()), query.getQueryOptions());
    else
      thumbnails = await this._handler.getInstances<LargeThumbnail>(LargeThumbnail, token, this.getRelativeUrl(imodelId, size, query.getId()), query.getQueryOptions());

    Logger.logTrace(loggingCategory, `Queried iModel ${imodelId} thumbnails`);

    return thumbnails;
  }

  /**
   * Downloads the thumbnail.
   * @param token Delegation token of the authorized user.
   * @param imodelId Id of the iModel.
   * @param thumbnail Small, Large or Tip thumbnail. Use 'get' function to query thumbnails or create tip thumbnail object.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes.
   */
  public async download(token: AccessToken, imodelId: string, thumbnail: Thumbnail | TipThumbnail): Promise<string> {

    if (this.isTipThumbnail(thumbnail)) {
      return await this.downloadTipThumbnail(token, thumbnail.projectId, imodelId, thumbnail.size);
    }

    const size: ThumbnailSize = thumbnail instanceof SmallThumbnail ? "Small" : "Large";
    const thumbnailId: string = thumbnail.wsgId;

    Logger.logInfo(loggingCategory, `Downloading ${size}Thumbnail ${thumbnailId} for iModel ${imodelId}`);

    const url: string = await this._handler.getUrl() + this.getRelativeUrl(imodelId, size, thumbnailId) + "/$file";
    const pngImage = await this.downloadThumbnail(token, url);

    Logger.logTrace(loggingCategory, `Downloaded ${size}Thumbnail ${thumbnailId} for iModel ${imodelId}`);

    return pngImage;
  }
}
