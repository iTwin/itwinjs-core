/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// __PUBLISH_EXTRACT_START__ IModelHubClient.example-code
import { IModelHubClient } from "@bentley/imodeljs-clients";
import { AzureFileHandler } from "@bentley/imodeljs-clients/lib/imodelhub/AzureFileHandler";

const imodelHubClient = new IModelHubClient(new AzureFileHandler());
// __PUBLISH_EXTRACT_END__
() => {
  if (!imodelHubClient)
    return;
};
