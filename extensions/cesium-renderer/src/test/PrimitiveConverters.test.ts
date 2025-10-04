/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../decorations/PrimitiveConverterFactory.js", () => {
  const factoryStub = {
    getConverter: vi.fn(),
    setConverter: vi.fn(),
    getCoordinateBuilder: vi.fn(),
    getCoordinateStorage: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/naming-convention
  return { PrimitiveConverterFactory: factoryStub };
});

import { Material, type PointPrimitive, type PointPrimitiveCollection, type Polyline, type PolylineCollection } from "@cesium/engine";
import { ColorDef } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import type { RenderGraphic } from "@itwin/core-frontend";
import type { RenderGraphicWithCoordinates } from "../decorations/PrimitiveConverter.js";
import { PointPrimitiveConverter } from "../decorations/PointPrimitiveConverter.js";
import { LineStringPrimitiveConverter } from "../decorations/LineStringPrimitiveConverter.js";
import type { CesiumScene } from "../CesiumScene.js";

class StubPointCollection {
  public items: PointPrimitive[] = [];

  public add = vi.fn((primitive: PointPrimitive) => {
    this.items.push(primitive);
    return primitive;
  });

  public get length(): number {
    return this.items.length;
  }

  public get = vi.fn((index: number) => this.items[index]);

  public remove = vi.fn((item: PointPrimitive) => {
    this.items = this.items.filter((candidate) => candidate !== item);
  });
}

class StubPolylineCollection {
  public items: Polyline[] = [];

  public add = vi.fn((polyline: Polyline) => {
    this.items.push(polyline);
    return polyline;
  });

  public get length(): number {
    return this.items.length;
  }

  public get = vi.fn((index: number) => this.items[index]);

  public remove = vi.fn((item: Polyline) => {
    this.items = this.items.filter((candidate) => candidate !== item);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PointPrimitiveConverter", () => {
  it("adds point primitives to the scene collection", () => {
    const converter = new PointPrimitiveConverter("pointstring");
    const collection = new StubPointCollection();
    const scene = { pointCollection: collection as unknown as PointPrimitiveCollection } as CesiumScene;

    const lineColor = ColorDef.from(10, 20, 30);
    const graphic = {
      geometries: [
        {
          coordinateData: [{ x: 5, y: 6, z: 7 }],
        },
      ],
      geometryType: "pointstring",
      symbology: { color: lineColor },
    } as unknown as RenderGraphicWithCoordinates;
    graphic._coordinateData = [
      {
        type: "pointstring",
        points: [Point3d.create(5, 6, 7)],
        symbology: { lineColor },
      },
    ];

    converter.convertDecorations([graphic as unknown as RenderGraphic], "world", scene);

    expect(collection.add).toHaveBeenCalledOnce();
    expect(collection.items).toHaveLength(1);

    const added = collection.items[0];
    expect(added.id).toBe("world_decoration_0");
    expect(added.pixelSize).toBe(20);
    expect(added.position?.x).toBeCloseTo(5);
    expect(added.position?.y).toBeCloseTo(6);
    expect(added.position?.z).toBeCloseTo(7);

    expect(added.color).toBeDefined();
    expect(added.outlineColor).toBeDefined();
  });

  it("applies overlay depth options for overlay decorations", () => {
    const converter = new PointPrimitiveConverter("pointstring");
    const collection = new StubPointCollection();
    const scene = { pointCollection: collection as unknown as PointPrimitiveCollection } as CesiumScene;

    const lineColor = ColorDef.from(40, 50, 60);
    const graphic = {
      geometries: [
        {
          coordinateData: [{ x: 1, y: 2, z: 3 }],
        },
      ],
      geometryType: "pointstring",
      symbology: { color: lineColor },
    } as unknown as RenderGraphicWithCoordinates;
    graphic._coordinateData = [
      {
        type: "pointstring",
        points: [Point3d.create(1, 2, 3)],
        symbology: { lineColor },
      },
    ];

    converter.convertDecorations([graphic as unknown as RenderGraphic], "worldOverlay", scene);

    const added = collection.items[0];
    expect(added.disableDepthTestDistance).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("LineStringPrimitiveConverter", () => {
  it("creates Cesium polylines from line string graphics", () => {
    const materialSpy = vi.spyOn(Material, "fromType").mockReturnValue({} as Material);

    const converter = new LineStringPrimitiveConverter("linestring");
    const collection = new StubPolylineCollection();
    const scene = { polylineCollection: collection as unknown as PolylineCollection } as CesiumScene;

    const lineColor = ColorDef.from(100, 110, 120);
    const graphic = {
      geometries: [
        {
          coordinateData: [
            { x: 0, y: 0, z: 0 },
            { x: 1, y: 1, z: 1 },
          ],
        },
      ],
      geometryType: "linestring",
      symbology: { color: lineColor },
    } as unknown as RenderGraphicWithCoordinates;
    graphic._coordinateData = [
      {
        type: "linestring",
        points: [Point3d.create(0, 0, 0), Point3d.create(1, 1, 1)],
        symbology: { lineColor },
      },
    ];

    converter.convertDecorations([graphic as unknown as RenderGraphic], "worldOverlay", scene);

    expect(materialSpy).toHaveBeenCalledOnce();
    expect(collection.add).toHaveBeenCalledOnce();
    expect(collection.items).toHaveLength(1);

    const added = collection.items[0];
    expect(added.id).toBe("worldOverlay_linestring_0");
    expect(added.positions).toHaveLength(2);
    expect(added.positions?.[1].x).toBeCloseTo(1);
    expect(added.positions?.[1].y).toBeCloseTo(1);
    expect(added.positions?.[1].z).toBeCloseTo(1);
    expect(added.width).toBe(2);
    const overlayOptions = added as unknown as { clampToGround?: boolean };
    expect(overlayOptions.clampToGround).toBe(false);
  });

  it("skips graphics without matching line string data", () => {
    const converter = new LineStringPrimitiveConverter("linestring");
    const collection = new StubPolylineCollection();
    const scene = { polylineCollection: collection as unknown as PolylineCollection } as CesiumScene;

    const graphic = {
      geometries: [],
      geometryType: "pointstring",
    } as unknown as RenderGraphicWithCoordinates;
    graphic._coordinateData = [
      {
        type: "pointstring",
        points: [Point3d.create(0, 0, 0)],
        symbology: {},
      },
    ];

    converter.convertDecorations([graphic as unknown as RenderGraphic], "world", scene);

    expect(collection.add).not.toHaveBeenCalled();
    expect(collection.items).toHaveLength(0);
  });
});







