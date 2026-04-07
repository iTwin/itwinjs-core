/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent } from "@itwin/core-bentley";
import { MapImagerySettings } from "@itwin/core-common";
import { describe, expect, it } from "vitest";
import { LayerTileTreeReference, LayerTileTreeReferenceHandler } from "../../internal/tile/LayerTileTreeReferenceHandler";
import { MapLayerTileTreeReference, TileTreeLoadStatus, TileTreeOwner } from "../../tile/internal";
import { SceneContext } from "../../ViewContext";
import { IModelConnection } from "../../IModelConnection";

/** Minimal mock event that tracks listener count */
function createMockEvent<T extends (...args: any[]) => void>() {
  const event = new BeEvent<T>();
  return event;
}

function createMockHandler() {
  const onMapImageryChanged = createMockEvent<(imagery: Readonly<MapImagerySettings>) => void>();
  const onChangeView = createMockEvent<(vp: any, prev: any) => void>();
  const onViewedModelsChanged = createMockEvent<(vp: any) => void>();

  const mockRef: LayerTileTreeReference = {
    iModel: {} as IModelConnection,
    treeOwner: {
      loadStatus: TileTreeLoadStatus.NotLoaded,
      load: () => undefined,
    } as unknown as TileTreeOwner,
    shouldDrapeLayer: (_layerTreeRef?: MapLayerTileTreeReference) => true,
  };

  const handler = new LayerTileTreeReferenceHandler(mockRef, false, undefined, [], false);

  const mockContext = {
    viewport: {
      displayStyle: {
        settings: {
          mapImagery: { backgroundBase: undefined, backgroundLayers: [] },
          onMapImageryChanged,
        },
      },
      onChangeView,
      onViewedModelsChanged,
    },
  } as unknown as SceneContext;

  return { handler, mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged };
}

describe("LayerTileTreeReferenceHandler", () => {

  it("registers listeners only once across multiple initializeLayers calls", () => {
    const { handler, mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged } = createMockHandler();

    // Call initializeLayers multiple times (simulating multiple frames)
    for (let i = 0; i < 10; i++)
      handler.initializeLayers(mockContext);

    // Each event should have exactly 1 listener, not 10
    expect(onMapImageryChanged.numberOfListeners).toBe(1);
    expect(onChangeView.numberOfListeners).toBe(1);
    expect(onViewedModelsChanged.numberOfListeners).toBe(1);
  });

  it("detachFromDisplayStyle removes all listeners", () => {
    const { handler, mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged } = createMockHandler();

    handler.initializeLayers(mockContext);
    expect(onMapImageryChanged.numberOfListeners).toBe(1);
    expect(onChangeView.numberOfListeners).toBe(1);
    expect(onViewedModelsChanged.numberOfListeners).toBe(1);

    handler.detachFromDisplayStyle();

    expect(onMapImageryChanged.numberOfListeners).toBe(0);
    expect(onChangeView.numberOfListeners).toBe(0);
    expect(onViewedModelsChanged.numberOfListeners).toBe(0);
  });

  it("can re-attach listeners after detach", () => {
    const { handler, mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged } = createMockHandler();

    handler.initializeLayers(mockContext);
    handler.detachFromDisplayStyle();

    // Re-attaching should work
    handler.initializeLayers(mockContext);
    expect(onMapImageryChanged.numberOfListeners).toBe(1);
    expect(onChangeView.numberOfListeners).toBe(1);
    expect(onViewedModelsChanged.numberOfListeners).toBe(1);
  });

  it("skips listener registration for map tiles", () => {
    const { mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged } = createMockHandler();

    const mockRef: LayerTileTreeReference = {
      iModel: {} as IModelConnection,
      treeOwner: {
        loadStatus: TileTreeLoadStatus.NotLoaded,
        load: () => undefined,
      } as unknown as TileTreeOwner,
      shouldDrapeLayer: () => true,
    };

    // mapTile = true should skip listener registration
    const mapTileHandler = new LayerTileTreeReferenceHandler(mockRef, false, undefined, [], true);
    mapTileHandler.initializeLayers(mockContext);

    expect(onMapImageryChanged.numberOfListeners).toBe(0);
    expect(onChangeView.numberOfListeners).toBe(0);
    expect(onViewedModelsChanged.numberOfListeners).toBe(0);
  });

  it("detachFromDisplayStyle is idempotent", () => {
    const { handler, mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged } = createMockHandler();

    handler.initializeLayers(mockContext);

    // Calling detach multiple times should not throw or misbehave
    handler.detachFromDisplayStyle();
    handler.detachFromDisplayStyle();

    expect(onMapImageryChanged.numberOfListeners).toBe(0);
    expect(onChangeView.numberOfListeners).toBe(0);
    expect(onViewedModelsChanged.numberOfListeners).toBe(0);
  });

  it("detachFromDisplayStyle without prior initializeLayers is a no-op", () => {
    const { handler } = createMockHandler();

    // Should not throw when no listeners have been registered
    expect(() => handler.detachFromDisplayStyle()).not.toThrow();
  });

  it("multiple handlers on same events are independently managed", () => {
    const { mockContext, onMapImageryChanged, onChangeView, onViewedModelsChanged } = createMockHandler();

    const makeRef = (): LayerTileTreeReference => ({
      iModel: {} as IModelConnection,
      treeOwner: {
        loadStatus: TileTreeLoadStatus.NotLoaded,
        load: () => undefined,
      } as unknown as TileTreeOwner,
      shouldDrapeLayer: () => true,
    });

    const handler1 = new LayerTileTreeReferenceHandler(makeRef(), false, undefined, [], false);
    const handler2 = new LayerTileTreeReferenceHandler(makeRef(), false, undefined, [], false);

    handler1.initializeLayers(mockContext);
    handler2.initializeLayers(mockContext);

    // Both handlers registered their own listeners
    expect(onMapImageryChanged.numberOfListeners).toBe(2);
    expect(onChangeView.numberOfListeners).toBe(2);
    expect(onViewedModelsChanged.numberOfListeners).toBe(2);

    // Detaching one handler should only remove its listeners
    handler1.detachFromDisplayStyle();
    expect(onMapImageryChanged.numberOfListeners).toBe(1);
    expect(onChangeView.numberOfListeners).toBe(1);
    expect(onViewedModelsChanged.numberOfListeners).toBe(1);

    handler2.detachFromDisplayStyle();
    expect(onMapImageryChanged.numberOfListeners).toBe(0);
    expect(onChangeView.numberOfListeners).toBe(0);
    expect(onViewedModelsChanged.numberOfListeners).toBe(0);
  });
});
