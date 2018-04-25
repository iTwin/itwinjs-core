/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHubBaseHandler } from "./BaseHandler";

import { request, RequestOptions } from "./../Request";
import { AccessToken } from "../Token";
import { Logger } from "@bentley/bentleyjs-core";

const loggingCategory = "imodeljs-clients.imodelhub";

/**
 * Handler for all methods related to thumbnails.
 */
export class ThumbnailHandler {
  private _handler: IModelHubBaseHandler;

  /**
   * Constructor for ThumbnailHandler. Should use @see IModelHubClient instead of directly constructing this.
   * @param handler Handler for WSG requests.
   */
  constructor(handler: IModelHubBaseHandler) {
    this._handler = handler;
  }

  /**
   * Gets relative url for Thumbnail requests.
   * @param projectId Id of the project.
   * @param imodelId Id of the imodel.
   * @param size Size of the thumbnail.
   */
  private getRelativeUrl(projectId: string, imodelId: string, size: "Large" | "Small") {
    return `/Repositories/Project--${projectId}/ProjectScope/${size}Thumbnail/${imodelId}/$file`;
  }

  /**
   * Gets thumbnails for an iModel.
   * @param token Delegation token of the authorized user.
   * @param projectId Id of the connect project.
   * @param imodelId Id of the iModel
   * @param size Size of the thumbnail. Pass 'Small' for 400x250 PNG image, and 'Large' for a 800x500 PNG image.
   * @return String for the PNG image that includes the base64 encoded array of the image bytes
   */
  public async get(token: AccessToken, projectId: string, imodelId: string, size: "Large" | "Small"): Promise<string> {
    Logger.logInfo(loggingCategory, `Querying thumbnail for iModel ${imodelId}`);

    const url: string = await this._handler.getUrl() + this.getRelativeUrl(projectId, imodelId, size);

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: token.toTokenString() },
      responseType: "blob",
    };

    const response = await request(url, options);

    const byteArray: Uint8Array|undefined = response.body;
    if (!byteArray || byteArray.length === 0) {
      return Promise.reject(new Error("Expected an image to be returned from the query"));
    }

    const base64Data = Base64.btoa(String.fromCharCode.apply(null, byteArray));
    const pngImage = "data:image/png;base64," + base64Data;

    Logger.logTrace(loggingCategory, `Queried thumbnail for iModel ${imodelId}`);

    return pngImage;
  }
}
