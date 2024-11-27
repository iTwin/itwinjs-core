import {
  createCesiumTerrainProvider,
  IModelApp,
  type TerrainMeshProviderOptions,
  type TerrainProvider,
} from "@itwin/core-frontend";

type ContentType =
  | "3DTiles"
  | "GLTF"
  | "IMAGERY"
  | "TERRAIN"
  | "KML"
  | "CZML"
  | "GEOJSON";

type ContentStatus =
  | "AWAITING_FILES"
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "ERROR"
  | "DATA_ERROR";

// https://developer.bentley.com/apis/cesium-curated-content/operations/list-content/#response-ref
interface CesiumContent {
  id: number;
  name: string;
  description: string;
  attribution: string;
  type: ContentType;
  status: ContentStatus;
}

interface ContentTileAttribution {
  html: string;
  collapsible: boolean;
}

// https://developer.bentley.com/apis/cesium-curated-content/operations/access-tiles/#response-ref
interface CesiumContentAccessTileProps {
  type: ContentType;
  url: string;
  accessToken: string; // we prob want to make this a cb
  attributions: ContentTileAttribution[];
}

interface CuratedCesiumContentOptions {
  assetId: number;
  iTwinId: string;
  accessToken: string;
  baseUrl?: string;
}

async function getCuratedCesiumContentProps({
  assetId,
  iTwinId,
  accessToken,
  baseUrl,
}: CuratedCesiumContentOptions): Promise<{ token?: string; url?: string }> {
  const apiUrl = `${
    baseUrl ?? "https://api.bentley.com"
  }/curated-content/cesium/${assetId}/tiles?iTwinId=${iTwinId}`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        /* eslint-disable @typescript-eslint/naming-convention */
        Authorization: accessToken,
        Accept: "application/vnd.bentley.itwin-platform.v1+json",
        Prefer: "return=representation",
        /* eslint-enable */
      },
    });

    if (!res.ok) {
      return {};
    }
    const accessTileProps = (await res.json()) as CesiumContentAccessTileProps;
    return { token: accessTileProps.accessToken, url: accessTileProps.url };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return {};
  }
}

export async function registerCesiumCuratedContentProvider({
  iTwinId,
}: {
  iTwinId?: string;
}): Promise<void> {
  const providerName = "CuratedCesiumContent";

  const provider: TerrainProvider = {
    createTerrainMeshProvider: async (options: TerrainMeshProviderOptions) => {
      const accessToken = await IModelApp.authorizationClient?.getAccessToken();

      if (!accessToken || !options.dataSource) {
        return undefined;
      }

      const { token, url } = await getCuratedCesiumContentProps({
        assetId: +options.dataSource,
        iTwinId:
          iTwinId ??
          "https://developer.bentley.com/apis/itwins/operations/get-my-primary-account/",
        accessToken,
      });
      return createCesiumTerrainProvider({
        ...options,
        accessToken: token,
        url,
      });
    },
  };

  IModelApp.terrainProviderRegistry.register(providerName, provider);
}
