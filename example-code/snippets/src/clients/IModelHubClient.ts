/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AzureFileHandler } from "@bentley/backend-itwin-client";
// __PUBLISH_EXTRACT_START__ IModelHubClient.example-code
import { IModelHubClient } from "@bentley/imodelhub-client";

const imodelHubClient = new IModelHubClient(new AzureFileHandler());
// __PUBLISH_EXTRACT_END__
// this is just to avoid unused variable compile error.
export const thisImodelHubClient = imodelHubClient;
