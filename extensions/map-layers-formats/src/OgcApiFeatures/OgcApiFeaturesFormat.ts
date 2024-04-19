/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ImageMapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { appendQueryParams, ImageryMapLayerFormat, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerSourceValidation, setBasicAuthorization, ValidateSourceArgs } from "@itwin/core-frontend";
import { OgcApiFeaturesProvider } from "./OgcApiFeaturesProvider";

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

      let url = appendQueryParams(source.url, source.savedQueryParams);
      url = appendQueryParams(url, source.unsavedQueryParams);
      let response = await fetch(url, opts);
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
        let collectionsUrl = appendQueryParams(collectionsLink.href, source.savedQueryParams);
        collectionsUrl = appendQueryParams(collectionsUrl, source.unsavedQueryParams);
        response = await fetch(collectionsUrl, opts);
        json = await response.json();
        if (Array.isArray(json.collections)) {
          subLayers = createCollectionsList(json);
          status = MapLayerSourceStatus.Valid;
        }

      }

      return { status, subLayers };

    } catch (err: any) {
      status = MapLayerSourceStatus.InvalidUrl;
      if (err?.status === 401) {
        status = ((userName && password) ? MapLayerSourceStatus.InvalidCredentials : MapLayerSourceStatus.RequireAuth);
      }
      return { status};
    }
  }
}
