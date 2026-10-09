/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { RealityDataSource } from "../../RealityDataSource";
import { RealityModelTileTreeProps } from "../../tile/internal";
import { Transform } from "@itwin/core-geometry";

export class Props extends RealityModelTileTreeProps {
  public constructor(src: RealityDataSource, extras?: any) {
    const json: any = {
      asset: {
        version: "1.0",
      },
      geometricError: 284.115,
      root: {
        boundingVolume: {
          sphere: [-4712810.182503086, 2617866.0424965154, -3397524.183610141, 142.05759547184317],
        },
        geometricError: 8,
        refine: "REPLACE",
        content: {
          uri: "root.b3dm",
        },
      },
    };

    if (extras) {
      json.asset.extras = extras;
    }

    super(json, {}, src, Transform.createIdentity());
  }
}

class Source implements RealityDataSource {
  public readonly key = {
    provider: "x",
    format: "y",
    id: "z",
  };
  public readonly isContextShare =  false;
  public readonly realityData =  undefined;
  public readonly realityDataId =  undefined;
  public readonly realityDataType =  undefined;

  public constructor(public readonly usesGeometricError: boolean | undefined, public readonly maximumScreenSpaceError: number | undefined) {
    //
  }

  public getServiceUrl = async () => Promise.resolve(undefined);
  public getTileContentType(): "tile" | "tileset" { return "tile" }
  public getRootDocument = async () => Promise.resolve({});
  public getTileContent = async () => Promise.resolve({});
  public getTileJson = async () => Promise.resolve({});
  public getTilesetUrl = () => undefined;
  public getSpatialLocationAndExtents = async () => Promise.resolve(undefined);
  public getPublisherProductInfo = async () => Promise.resolve(undefined);
}

function expectMaxSSE(expected:number | undefined, useGeometricError?: boolean, maxSSE?: number | undefined, extras?: any): void {
  const source = new Source(useGeometricError, maxSSE);
  const props = new Props(source, extras);
  expect(props.usesGeometricError).to.equal(undefined !== props.maximumScreenSpaceError);
  expect(props.maximumScreenSpaceError).to.equal(expected);
}

describe("RealityTileTreeProps", () => {
  it("uses geometric error for declared splats while preserving ordinary tileset defaults", () => {
    const root = { boundingVolume: { sphere: [0, 0, 0, 1] }, geometricError: 1, content: { uri: "splats.glb" } };
    const json = { asset: { version: "1.1" }, root };
    const source = new Source(false, undefined);
    const ordinary = new RealityModelTileTreeProps(json, root, source, Transform.createIdentity());
    expect(ordinary.isGaussianSplat).toBe(false);
    expect(ordinary.maximumScreenSpaceError).toBeUndefined();
    for (const declaration of ["extensionsUsed", "extensionsRequired"]) {
      const splats = { ...json, extensions: { "3DTILES_content_gltf": { [declaration]: ["KHR_gaussian_splatting"] } } };
      const props = new RealityModelTileTreeProps(splats, root, source, Transform.createIdentity());
      expect(props.isGaussianSplat).toBe(true);
      expect(props.usesGeometricError).toBe(true);
      expect(props.maximumScreenSpaceError).toBe(16);
      const custom = { ...splats, asset: { ...splats.asset, extras: { maximumScreenSpaceError: 64 } } };
      expect(new RealityModelTileTreeProps(custom, root, source, Transform.createIdentity()).maximumScreenSpaceError).toBe(64);
    }
  });

  it("doesn't use geometric error by default", () => {
    expectMaxSSE(undefined);
    expectMaxSSE(undefined, false, undefined);
    expectMaxSSE(undefined, false, 123);
    expectMaxSSE(undefined, undefined, undefined, { maximumScreenSpaceError: undefined });
    expectMaxSSE(undefined, undefined, undefined, { maximumScreenSpaceError: null });
    expectMaxSSE(undefined, undefined, undefined, { maximumScreenSpaceError: "123" });
  });

  it("uses max SSE from RealityDataSource", () => {
    expectMaxSSE(123, true, 123);
    expectMaxSSE(16, true, undefined);
  });

  it("uses max SSE from tileset", () => {
    expectMaxSSE(456, undefined, undefined, { maximumScreenSpaceError: 456 });
  });

  it("prefers max SSE specified by tileset", () => {
    expectMaxSSE(456, true, 123, { maximumScreenSpaceError: 456 });
  });
});
