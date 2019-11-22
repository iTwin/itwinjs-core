/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// __PUBLISH_EXTRACT_START__ IModelHubClient.example-code
import { IModelHubClient } from "@bentley/imodeljs-clients";
import { AzureFileHandler, IOSAzureFileHandler } from "@bentley/imodeljs-clients-backend";
import { MobileRpcConfiguration } from "@bentley/imodeljs-common";

const imodelHubClient = new IModelHubClient(MobileRpcConfiguration.isMobileBackend ? new IOSAzureFileHandler() : new AzureFileHandler());
// __PUBLISH_EXTRACT_END__
// this is just to avoid unused variable compile error.
export const thisImodelHubClient = imodelHubClient;
