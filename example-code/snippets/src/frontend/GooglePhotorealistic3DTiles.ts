/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { getGooglePhotorealistic3DTilesURL, IModelApp, RealityDataSourceGP3DTProvider, Viewport } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ GooglePhotorealistic3DTiles_providerApiKey
export async function setUpGP3DTProviderWithApiKey(viewport: Viewport, apiKey: string) {
  // Specify your API key in the provider options
  const provider = new RealityDataSourceGP3DTProvider({ apiKey });
  // The provider must be initialized before attaching, to load imagery for its decorator
  await provider.initialize();

  // Register the provider with a name that will also be used to attach the reality model
  IModelApp.realityDataSourceProviders.register("GP3DT", provider);

  // This function just provides the GP3DT URL, or you can get it another way via a service, etc.
  const url = getGooglePhotorealistic3DTilesURL();

  viewport.displayStyle.attachRealityModel({
    tilesetUrl: url,
    name: "googleMap3dTiles",
    rdSourceKey: {
      // Must be the same name you registered your provider under
      provider: "GP3DT",
      format: "ThreeDTile",
      id: url,
    },
  });
}
// __PUBLISH_EXTRACT_END__;

// __PUBLISH_EXTRACT_START__ GooglePhotorealistic3DTiles_providerGetAuthToken
export async function setUpGP3DTProviderWithGetAuthToken() {
  const fetchToken = async () => {
    const apiUrl = "https://my-api.com/";
    const response = await fetch(apiUrl);
    const data = await response.json();
    return data.accessToken;
  }
  // Specify the getAuthToken function to authenticate via authorization header in the GP3DT request, instead of API key
  const provider = new RealityDataSourceGP3DTProvider({ getAuthToken: fetchToken });
  await provider.initialize();

  // Next you can register the provider and attach the reality model, etc.
}
// __PUBLISH_EXTRACT_END__;