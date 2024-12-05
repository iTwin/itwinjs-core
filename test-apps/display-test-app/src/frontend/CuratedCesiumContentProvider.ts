import { CesiumTerrainAssetId } from "@itwin/core-common";
import {
  createCesiumTerrainProvider,
  IModelApp,
  type TerrainMeshProviderOptions,
  type TerrainProvider,
} from "@itwin/core-frontend";

interface ITPReq {
  accessToken: string;
  baseUrl?: string;
}

interface CuratedCesiumContentOptions extends ITPReq {
  assetId: number;
  iTwinId: string;
}

function genHeaders(accessToken: string) {
  return {
    headers: {
      /* eslint-disable @typescript-eslint/naming-convention */
      Authorization: accessToken,
      Accept: "application/vnd.bentley.itwin-platform.v1+json",
      Prefer: "return=representation",
      /* eslint-enable */
    },
  };
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
    const res = await fetch(apiUrl, genHeaders(accessToken));
    if (!res.ok) {
      return {};
    }
    const accessTileProps = (await res.json()) as {
      accessToken: string;
      url: string;
    };
    return { token: accessTileProps.accessToken, url: accessTileProps.url };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return {};
  }
}

// https://developer.bentley.com/apis/itwins/operations/get-my-primary-account/
async function getAccountITwin({
  accessToken,
  baseUrl,
}: ITPReq): Promise<string> {
  const apiUrl = `${
    baseUrl ?? "https://api.bentley.com"
  }/itwins/myprimaryaccount`;

  try {
    const res = await fetch(apiUrl, genHeaders(accessToken));
    if (!res.ok) {
      return "";
    }

    const { iTwin } = (await res.json()) as { iTwin: { id: string } };
    return iTwin.id;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    return "";
  }
}

export async function registerCesiumCuratedContentProvider({
  iTwinId,
  baseUrl,
}: {
  iTwinId?: string;
  baseUrl?: string;
}): Promise<void> {
  const providerName = "CuratedCesiumContent";

  const provider: TerrainProvider = {
    createTerrainMeshProvider: async (options: TerrainMeshProviderOptions) => {
      const accessToken = await IModelApp.authorizationClient?.getAccessToken();
      if (!accessToken) {
        return undefined;
      }

      iTwinId = iTwinId ?? (await getAccountITwin({ accessToken, baseUrl }));

      const { token, url } = await getCuratedCesiumContentProps({
        assetId: +(options.dataSource || CesiumTerrainAssetId.Default),
        iTwinId,
        accessToken,
        baseUrl,
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
