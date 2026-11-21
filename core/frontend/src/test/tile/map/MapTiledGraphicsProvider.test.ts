/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DisplayStyle3dProps } from "@itwin/core-common";
import { DisplayStyle3dState } from "../../../DisplayStyleState";
import { IModelApp } from "../../../IModelApp";
import { IModelConnection } from "../../../IModelConnection";
import { MockRender } from "../../../internal/render/MockRender";
import { DisclosedTileTreeSet, MapTiledGraphicsProvider, TileTree, TileTreeOwner } from "../../../tile/internal";
import { createBlankConnection } from "../../createBlankConnection";

const styleProps: DisplayStyle3dProps = {
  classFullName: "BisCore:DisplayStyle3d",
  model: "0",
  code: { spec: "0x1", scope: "0x1", value: "" },
};

describe("MapTiledGraphicsProvider", () => {
  let imodel: IModelConnection;

  beforeEach(async () => {
    await MockRender.App.startup();
    imodel = createBlankConnection("map");
  });

  afterEach(async () => {
    await imodel.close();
    if (IModelApp.initialized)
      await MockRender.App.shutdown();
  });

  it("clears the draped background imagery when one of its imagery trees loads", () => {
    const provider = new MapTiledGraphicsProvider(1, new DisplayStyle3dState(styleProps, imodel));
    const imageryTree = {} as TileTree;
    vi.spyOn(provider.backgroundDrapeMap, "discloseTileTrees").mockImplementation((trees: DisclosedTileTreeSet) => trees.add(imageryTree));
    const clearDrape = vi.spyOn(provider.backgroundDrapeMap.layerRefHandler, "clearLayers");
    const clearBackground = vi.spyOn(provider.backgroundMap.layerRefHandler, "clearLayers");

    try {
      IModelApp.tileAdmin.onTileTreeLoad.raiseEvent({ tileTree: imageryTree } as TileTreeOwner);
      expect(clearDrape).toHaveBeenCalledOnce();
      expect(clearBackground).not.toHaveBeenCalled();
    } finally {
      provider.detachFromDisplayStyle();
    }
  });
});
