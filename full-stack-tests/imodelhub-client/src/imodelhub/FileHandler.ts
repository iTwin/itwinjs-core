/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AzureFileHandler, LocalhostHandler, StorageServiceFileHandler, UrlFileHandler } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import { TestConfig } from "../TestConfig";

export function createFileHandler(useDownloadBuffer?: boolean) {
  if (TestConfig.enableIModelBank && !TestConfig.enableMocks) {
    return createIModelBankFileHandler(useDownloadBuffer);
  }
  return new AzureFileHandler(useDownloadBuffer);
}

export function createIModelBankFileHandler(useDownloadBuffer?: boolean) {
  const handler = process.env.IMJS_TEST_IMODEL_BANK_FILE_HANDLER ?? "url";
  switch (handler.toLowerCase()) {
    case "azure":
      return new AzureFileHandler(useDownloadBuffer);
    case "localhost":
      return new LocalhostHandler();
    case "url":
      return new UrlFileHandler();
    case "storageservice":
      return new StorageServiceFileHandler();
    default:
      throw new Error(`File handler '${handler}' is not supported.`);
  }
}
