/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { GeographicCRSProps } from "@itwin/core-common";
import { GeoServices, GeoServicesOptions } from "../GeoServices";

describe.only("GeoServices", () => {
  function makeGeoServices(opts: Partial<GeoServicesOptions> = { }): GeoServices {
    return new GeoServices({
      isIModelClosed: opts.isIModelClosed ?? (() => false),
      toIModelCoords: opts.toIModelCoords ?? (async () => Promise.resolve([])),
      fromIModelCoords: opts.fromIModelCoords ?? (async () => Promise.resolve([])),
    });
  }

  it("caches GeoConverters by datum name", () => {
    const gs = makeGeoServices();
    const a = gs.getConverter("a");
    expect(gs.getConverter("a")).to.equal(a);

    const b = gs.getConverter("b");
    expect(b).not.to.equal(a);
    expect(gs.getConverter("b")).to.equal(b);

    expect(gs.getConverter()).to.equal(gs.getConverter());
  });

  it("caches GeoConverters by coordinate system JSON", () => {
    const gs = makeGeoServices();
    const a = gs.getConverter({});
    expect(gs.getConverter({})).to.equal(a);

    const gcrs: GeographicCRSProps = {
      additionalTransform: {
        helmert2DWithZOffset: {
          translationX: 0,
          translationY: 1,
          translationZ: 2,
          rotDeg: 3,
          scale: 4,
        },
      },
    };

    const b = gs.getConverter(gcrs);
    expect(gs.getConverter(gcrs)).to.equal(b);
    expect(b).not.to.equal(a);

    gcrs.additionalTransform!.helmert2DWithZOffset!.scale = 5;
    const c = gs.getConverter(gcrs);
    expect(c).not.to.equal(b);
    expect(gs.getConverter(gcrs)).to.equal(c);
  });

  it("removes converter from cache once all requests complete", async () => {
  });

  it("removes converter from cache even if requests produce an exception", async () => {
  });

  it("retains converter in cache while requests are outstanding", async () => {
  });

  it("retains converter in cache if no requests are received", async () => {
    const gs = makeGeoServices();
    const cv = gs.getConverter()!;
    await BeDuration.wait(1);
    expect(gs.getConverter()).to.equal(cv);

    await cv.convertToIModelCoords([[0, 1, 2]]);
    expect(gs.getConverter()).not.to.equal(cv);
  });

  it("batches requests received within a single frame", async () => {
  });
});
