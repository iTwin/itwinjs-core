/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AzureFileHandler, LocalhostHandler, StorageServiceFileHandler, UrlFileHandler } from "@bentley/backend-itwin-client";
import { Config } from "@bentley/bentleyjs-core";
import { FileHandler } from "@bentley/itwin-client";
import { TestConfig } from "../TestConfig";

export function createFileHandler(useDownloadBuffer?: boolean): FileHandler {
  if (TestConfig.enableIModelBank && !TestConfig.enableMocks) {
    return createIModelBankFileHandler(useDownloadBuffer);
  }
  return new AzureFileHandler(useDownloadBuffer);
}

export function createIModelBankFileHandler(useDownloadBuffer?: boolean): FileHandler {
  const handler = Config.App.getString("imjs_test_imodel_bank_file_handler", "url");
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
