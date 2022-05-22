/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { UrlFileHandler } from "./UrlFileHandler";

/**
 * Provides methods to upload and download files using sample Storage Service implementation
 * @internal
 */
export class StorageServiceFileHandler extends UrlFileHandler {
  constructor() {
    super();
    this._uploadMethod = "PUT";
  }
}
