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
