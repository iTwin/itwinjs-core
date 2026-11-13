/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { MockRender } from "../../internal/render/MockRender";
import { TileUser } from "../../tile/internal";
import { createBlankConnection } from "../createBlankConnection";
import { ScriptedTile, ScriptedTree, selectScripted } from "./ScriptedRealityTiles";

/** Bytes every scripted tile holds. */
const tileBytes = 1000;

const leaves = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4", "c1", "c2", "c3", "c4", "d1", "d2", "d3", "d4"];
const quadrants = ["a", "b", "c", "d"];

describe("Coarsening reality tiles within the tile memory limit", () => {
  let imodel: IModelConnection;
  let root: ScriptedTile;
  let user: TileUser;
  let selected: string[];
  /** Loads of content that the tile cache had freed. */
  let reloads: number;
  const admin = () => IModelApp.tileAdmin;

  function load(tile: ScriptedTile): void {
    tile.bytes = tileBytes;
    tile.setIsReady();
    admin().onTileContentLoaded(tile);
  }

  /** A loaded quadtree whose root (error 64 pixels) refines into four tiles (32), each refining into four leaves (8). */
  function loadQuadtree(): ScriptedTile {
    const quadtreeRoot = new ScriptedTree(imodel).root({ sse: 64 });
    load(quadtreeRoot);
    for (const quadrant of quadrants) {
      const child = quadtreeRoot.add(quadrant, { sse: 32 }, false);
      load(child);
      for (const leaf of [1, 2, 3, 4])
        load(child.add(`${quadrant}${leaf}`, { sse: 8 }));
    }

    return quadtreeRoot;
  }

  beforeEach(async () => {
    await MockRender.App.startup();
    IModelApp.stopEventLoop();
    imodel = createBlankConnection("tile-memory-coarsening");
    root = loadQuadtree();
    user = { tileUserId: TileUser.generateId(), iModel: imodel, discloseTileTrees: () => undefined };
    admin().registerUser(user);
    selected = [];
    reloads = 0;
  });

  afterEach(async () => {
    await imodel.close();
    await MockRender.App.shutdown();
  });

  /** One frame: the viewport selects, content the tile cache freed is loaded again as soon as the viewport misses it, and the tile
   * admin processes memory.
   */
  function frame(): void {
    admin().clearTilesForUser(user);
    const result = selectScripted(root);
    admin().addTilesForUser(user, result.context.selected, new Set(), result.args.touchedTiles);
    selected = result.selected;
    for (const tile of result.context.missing) {
      reloads++;
      load(tile as ScriptedTile);
    }

    admin().process();
  }

  /** Run frames until the memory factor has not changed for a second's worth of them. */
  function settle(): void {
    let unchanged = 0;
    for (let i = 0; i < 1000 && unchanged < 60; i++) {
      const factor = admin().memoryScreenSpaceErrorFactor;
      frame();
      unchanged = factor === admin().memoryScreenSpaceErrorFactor ? unchanged + 1 : 0;
    }

    expect(unchanged).toBe(60);
  }

  /** Expect more frames to change nothing: no selection, no factor and no reload. */
  function expectStable(): void {
    const selectedBefore = selected, factorBefore = admin().memoryScreenSpaceErrorFactor, reloadsBefore = reloads;
    for (let i = 0; i < 300; i++)
      frame();

    expect(selected).toEqual(selectedBefore);
    expect(admin().memoryScreenSpaceErrorFactor).toBe(factorBefore);
    expect(reloads).toBe(reloadsBefore);
  }

  /** Select full detail, which keeps every loaded tile in use. Returns the bytes of the tiles in use. */
  function selectFullDetail(): number {
    frame();
    expect(selected).toEqual(leaves);
    return admin().totalTileContentBytes;
  }

  it("coarsens while the tiles in use exceed the limit, then holds without reloading", () => {
    const fullDetailBytes = selectFullDetail();

    admin().gpuMemoryLimit = 0.6 * fullDetailBytes;
    settle();

    expect(selected).toEqual(quadrants);
    expect(admin().totalTileContentBytes).toBeLessThanOrEqual(admin().maxTotalTileContentBytes!);
    expectStable();
  });

  it("does not coarsen when content it cannot coarsen alone exceeds the limit", () => {
    const fullDetailBytes = selectFullDetail();

    // Content selected by size on screen, like iModel tiles, exceeds the limit by itself; the quadtree's full detail fits in half of it.
    const other = new ScriptedTree(imodel).root({ sse: 1, selectedBySize: true }, "other");
    other.bytes = 3 * fullDetailBytes;
    other.setIsReady();
    admin().onTileContentLoaded(other);
    admin().addTilesForUser({ tileUserId: TileUser.generateId(), iModel: imodel, discloseTileTrees: () => undefined }, [other], new Set(), new Set());
    admin().gpuMemoryLimit = 2.5 * fullDetailBytes;
    settle();

    expect(selected).toEqual(leaves);
    expect(admin().memoryScreenSpaceErrorFactor).toBe(1);
    expectStable();
  });
});
