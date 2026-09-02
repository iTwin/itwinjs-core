/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { appendQueryParams, credentialedRequestRedirect, fetchMapLayerRequest, ImageryMapLayerFormat, IModelApp, MapLayerAuthenticationFailedError, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, setBasicAuthorization, ValidateSourceArgs } from "@itwin/core-frontend";
import { OgcApiFeaturesProvider } from "./OgcApiFeaturesProvider.js";

/** @internal */
export class OgcApiFeaturesMapLayerFormat extends ImageryMapLayerFormat {
  public static override formatId = "OgcApiFeatures";
  public static override createImageryProvider(settings: ImageMapLayerSettings): MapLayerImageryProvider | undefined { return new OgcApiFeaturesProvider(settings); }

  public static override async validate(args: ValidateSourceArgs): Promise<MapLayerSourceValidation> {

    const {source} = args;
    const { userName, password } = source;
    let status = MapLayerSourceStatus.InvalidUrl;
    try {

      let headers: Headers | undefined;
      if (userName && password) {
        headers = new Headers();
        setBasicAuthorization(headers, userName, password);
      }
      const opts: RequestInit = {
        method: "GET",
        headers,
      };

      // Classify HTTP failures before parsing JSON, using the final response URL to enforce origin trust after redirects.
      const classifyResponseFailure = async (httpResponse: Response, requestedUrl: string): Promise<MapLayerSourceValidation | undefined> => {
        if (httpResponse.ok)
          return undefined;

        if (httpResponse.status === 401 || httpResponse.status === 403) {
          const challengedUrl = httpResponse.url || requestedUrl;
          if (!IModelApp.mapLayerFormatRegistry.isCredentialsSharingAllowed(challengedUrl, source.url)) {
            let blockedOrigin: string | undefined;
            try { blockedOrigin = new URL(challengedUrl).origin; } catch { /* non-hierarchical URL */ }
            return { status: MapLayerSourceStatus.UntrustedOrigin, blockedOrigin };
          }

          return { status: (userName && password) ? MapLayerSourceStatus.InvalidCredentials : MapLayerSourceStatus.RequireAuth };
        }

        return { status: MapLayerSourceStatus.InvalidUrl };
      };

      let url = appendQueryParams(source.url, source.savedQueryParams);
      url = appendQueryParams(url, source.unsavedQueryParams);
      const allowLandingCredentials = IModelApp.mapLayerFormatRegistry.isCredentialsSharingAllowed(url, source.url);
      if (headers && allowLandingCredentials)
        IModelApp.mapLayerFormatRegistry.logUntrustedOriginUse(url, source.url);

      // Routes each validation request through the registered fetch handler (if any); a
      // MapLayerAuthenticationFailedError thrown by the handler is converted to RequireAuth below.
      const doRequest = async (requestUrl: string, baseOpts: RequestInit): Promise<Response> => {
        const urlObj = new URL(requestUrl);
        return fetchMapLayerRequest({
          url: urlObj,
          formatId: source.formatId,
          layerUrl: source.url,
          baseHeaders: baseOpts.headers ? new Headers(baseOpts.headers) : undefined,
          send: async (sendArgs) =>
            // Sends issued through a fetch handler get the same redirect policy as credentialed ones.
            fetch(sendArgs.url, { ...baseOpts, headers: sendArgs.headers, redirect: sendArgs.credentialed ? credentialedRequestRedirect() : baseOpts.redirect }),
        });
      };

      let response = await doRequest(url, allowLandingCredentials ? opts : { method: "GET" });
      const landingFailure = await classifyResponseFailure(response, url);
      if (landingFailure)
        return landingFailure;

      let json = await response.json();
      if (!json) {
        return { status };
      }

      const createCollectionsList = (data: any) => {
        let array: MapSubLayerProps[] | undefined;
        for (const collection of data.collections) {
          if (collection.itemType === "feature") {
            const subLayerProps = {
              id: collection.id,
              name: collection.id,
              title: collection.title,
              visible: true,
              parent: undefined,
              children: undefined,
            };
            if (array)
              array.push(subLayerProps);
            else
              array = [subLayerProps];
          }
        }
        return array;
      };

      let subLayers: MapSubLayerProps[] | undefined;
      if (Array.isArray(json.collections)) {
        subLayers = createCollectionsList(json);
        status = MapLayerSourceStatus.Valid;
      } else if (json.itemType === "feature" || json.type === "FeatureCollection") {
        // We expect one of the following URL:
        // http://server/collections/<collectionName>
        // http://server/collections/<collectionName>/items
        subLayers = [{
          id: json.id,
          name: json.id,
          title: json.title,
          visible: true,
          parent: undefined,
          children: undefined,
        }];
        status = MapLayerSourceStatus.Valid;
      } else if (Array.isArray(json.links)) {
        // This might be the main landing page
        const collectionsLink = json.links.find((link: any)=> link.rel.includes("data") && link.type === "application/json");
        // Landing-page links are allowed to be relative, so resolve them against the URL the landing document
        // was actually served from (which may differ from the requested one if the request was redirected)
        // before appending query parameters or evaluating trust.
        let collectionsUrl = new URL(collectionsLink.href, response.url || url).toString();
        collectionsUrl = appendQueryParams(collectionsUrl, source.savedQueryParams);
        collectionsUrl = appendQueryParams(collectionsUrl, source.unsavedQueryParams);

        // The collections link is advertised by the server-controlled landing document, so the trust
        // decision is applied to it independently of the source URL.
        const allowCreds = IModelApp.mapLayerFormatRegistry.isCredentialsSharingAllowed(collectionsUrl, source.url);
        if (headers && allowCreds)
          IModelApp.mapLayerFormatRegistry.logUntrustedOriginUse(collectionsUrl, source.url);

        response = await doRequest(collectionsUrl, allowCreds ? opts : { method: "GET" });
        const collectionsFailure = await classifyResponseFailure(response, collectionsUrl);
        if (collectionsFailure)
          return collectionsFailure;

        json = await response.json();
        if (Array.isArray(json.collections)) {
          subLayers = createCollectionsList(json);
          status = MapLayerSourceStatus.Valid;
        }

      }

      return { status, subLayers };

    } catch (err: any) {
      // The fetch handler is the authentication authority for the requests it manages.
      if (err instanceof MapLayerAuthenticationFailedError)
        return { status: MapLayerSourceStatus.RequireAuth };
      status = MapLayerSourceStatus.InvalidUrl;
      if (err?.status === 401) {
        status = ((userName && password) ? MapLayerSourceStatus.InvalidCredentials : MapLayerSourceStatus.RequireAuth);
      }
      return { status};
    }
  }
}
