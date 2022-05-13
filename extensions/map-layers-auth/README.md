# @itwin/map-layers-auth

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Description

The __@itwin/map-layers-auth__ package contains classes for enabling various authentification methods, such as OAuth2.

## ArcGIS OAuth2 suport

To enable the ArcGIS OAuth2 suport, an 'ArcGisAccessClient' object needs to be created and registered in the MapLayerFormatRegistry from __@itwin/imodeljs-frontend__ for the 'ArcGIS' format.

Also the following configuration will be required: 

1. __Callback URL__\
Hosting application needs implement its own callback page, and set its URL on the create `ArcGisAccessClient` object.\
Following code demonstrates how this can be implemented as a simple React hook:
```
import * as React from "react";
export function ArcGisOauthRedirect() {
  const completeLogin = () => {
    if (window.opener) {
      const opener = (window.opener);
      if (opener?.arcGisOAuth2Callback) {
        opener.arcGisOAuth2Callback(window.location);
      }
    }
  };
  React.useEffect(() => {
    completeLogin();
  }, []);
}
```

2. __Client IDs__\
The hosting application must be registered in either the ArcGIS Online server (cloud offering) or an ArcGIS enterprise server (on-premise). The registered application must then provide it's associated clientID and redirectUri to the `ArcGgisAccessClient` object.  The ui-test-app application provides a complete sample configuration. 
The maplayers widget has also been updated to support OAuth2: if needed, a popup window will be displayed to trigger the external OAuth process with the remote ArcGIS server. When the process completes, the focus returns to the map-layers widget and layer is ready to be added/displayed.\
\
More details on how to configure the ArcGis Server can be found in the [ESRI documentation](https://developers.arcgis.com/documentation/mapping-apis-and-services/security/tutorials/register-your-application/)\
\
`ArcGisAccessClient` initialization example:
```ts
  const enterpriseClientIds = [{
      serviceBaseUrl: SampleAppIModelApp.testAppConfiguration.arcGisEnterpriseBaseUrl,
      clientId: SampleAppIModelApp.testAppConfiguration?.arcGisEnterpriseClientId,
    }];
  const accessClient = new ArcGisAccessClient();
  const initStatus = accessClient.initialize({
    redirectUri: "http://localhost:3000/esri-oauth2-callback",
    clientIds: {
      arcgisOnlineClientId: SampleAppIModelApp?.testAppConfiguration?.arcGisOnlineClientId,
      enterpriseClientIds,
    }});
  IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", accessClient);
```


