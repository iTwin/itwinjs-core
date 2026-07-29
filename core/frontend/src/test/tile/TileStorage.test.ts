/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { FrontendStorage } from "@itwin/object-storage-core/lib/frontend";
import { describe, expect, it, vi } from "vitest";
import { IModelTileRpcInterface } from "@itwin/core-common";
import { TileStorage } from "../../tile/TileStorage";

describe("TileStorage", () => {
  it("caches an undefined transfer configuration and skips object storage downloads", async () => {
    const getTileCacheConfig = vi.fn().mockResolvedValue(undefined);
    const getClient = vi.spyOn(IModelTileRpcInterface, "getClient").mockReturnValue({ getTileCacheConfig } as unknown as IModelTileRpcInterface);
    const download = vi.fn();
    const storage = new TileStorage({ download } as unknown as FrontendStorage);
    const tokenProps = { key: "test" };

    try {
      expect(await storage.downloadTile(tokenProps, "imodel", "changeset", "tree", "tile")).toBeUndefined();
      expect(await storage.downloadTile(tokenProps, "imodel", "changeset", "tree", "tile-2")).toBeUndefined();

      expect(getTileCacheConfig).toHaveBeenCalledTimes(1);
      expect(download).not.toHaveBeenCalled();
    } finally {
      getClient.mockRestore();
    }
  });
});
