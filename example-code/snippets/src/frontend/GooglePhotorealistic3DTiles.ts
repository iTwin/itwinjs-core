/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { getGoogle3dTilesUrl, Google3dTilesProvider, IModelApp, Viewport } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ GooglePhotorealistic3dTiles_providerApiKey
export async function setUpGoogle3dTilesProviderWithApiKey(viewport: Viewport, apiKey: string) {
  // Specify your API key in the provider options
  const provider = new Google3dTilesProvider({ apiKey });
  // The provider must be initialized before attaching, to load imagery for its decorator
  await provider.initialize();

  // Register the provider with a name that will also be used to attach the reality model
  IModelApp.realityDataSourceProviders.register("google3dTiles", provider);

  // This function just provides the Google 3D Tiles URL, or you can get it another way via a service, etc.
  const url = getGoogle3dTilesUrl();

  viewport.displayStyle.attachRealityModel({
    tilesetUrl: url,
    name: "google3dTiles",
    rdSourceKey: {
      // provider property must be the same name you registered your provider under
      provider: "google3dTiles",
      format: "ThreeDTile",
      id: url,
    },
  });
}
// __PUBLISH_EXTRACT_END__;

// __PUBLISH_EXTRACT_START__ GooglePhotorealistic3dTiles_providerGetAuthToken
export async function setUpGoogle3dTilesProviderWithGetAuthToken() {
  const fetchToken = async () => {
    const apiUrl = "https://my-api.com/";
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data.accessToken;
  }
  // Specify the getAuthToken function to authenticate via authorization header in the Google 3D Tiles request, instead of API key
  const provider = new Google3dTilesProvider({ getAuthToken: fetchToken });
  await provider.initialize();

  // Next you can register the provider and attach the reality model, etc.
}
// __PUBLISH_EXTRACT_END__;