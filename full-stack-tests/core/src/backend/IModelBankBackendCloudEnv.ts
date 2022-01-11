/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

import { IModelBankClient } from "@bentley/imodelbank-client";
import { UrlFileHandler } from "@bentley/imodelbank-client/lib/cjs/itwin-client/file-handlers";
import { IModelHubBackend } from "@bentley/imodelbank-client/lib/cjs/imodelhub-node";
import { BackendHubAccess } from "@itwin/core-backend";

export const assetsPath = `${__dirname}/../../../lib/test/assets/`;
export const workDir = `${__dirname}/../../../lib/test/output/`;

// To run tests with imodel-bank integration:
// set IMJS_TEST_IMODEL_BANK to true to run tests with imodel-bank. Then either:
// set IMJS_TEST_IMODEL_BANK_URL to specify the url to locally deployed orchestrator
// or set the following so the tests would deploy a local orchestrator themselves:
// set IMJS_TEST_IMODEL_BANK_RUN_ORCHESTRATOR=%SrcRoot%\imodel-bank\local-orchestrator\lib\server.js
// set IMJS_TEST_IMODEL_BANK_LOGGING_CONFIG=<somewhere>logging.config.json

export function getIModelBankAccess(): BackendHubAccess {
  const orchestratorUrl: string = process.env.IMJS_TEST_IMODEL_BANK_URL ?? "";

  const bankClient = new IModelBankClient(orchestratorUrl, new UrlFileHandler());

  const hubAccess = new IModelHubBackend(bankClient);
  return hubAccess;
}
