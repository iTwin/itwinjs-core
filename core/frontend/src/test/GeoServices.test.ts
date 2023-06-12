/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeDuration, BeEvent } from "@itwin/core-bentley";
import { GeographicCRSProps, PointWithStatus } from "@itwin/core-common";
import { GeoServices, GeoServicesOptions } from "../GeoServices";

describe("GeoServices", () => {
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
    const gs = makeGeoServices();
    const cv = gs.getConverter()!;
    expect(gs.getConverter()).to.equal(cv);

    await cv.convertToIModelCoords([[0, 1, 2]]);
    const cv2 = gs.getConverter()!;
    expect(cv2).not.to.equal(cv);
    expect(gs.getConverter()).to.equal(cv2);

    await cv2.convertFromIModelCoords([[2, 1, 0]]);
    expect(gs.getConverter()).not.to.equal(cv2);
  });

  async function waitOneFrame(): Promise<void> {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  it("retains converter in cache until all requests complete", async () => {
    async function resolveAfter2Frames(): Promise<PointWithStatus[]> {
      await waitOneFrame();
      return new Promise<PointWithStatus[]>((resolve) => {
        requestAnimationFrame(() => {
          resolve([]);
        });
      });
    }

    const gs = makeGeoServices({
      toIModelCoords: async () => resolveAfter2Frames(),
      fromIModelCoords: async () => resolveAfter2Frames(),
    });

    const cv = gs.getConverter()!;
    const promises: Array<Promise<PointWithStatus[]>> = [];
    promises.push(cv.convertToIModelCoords([[0, 0, 0]]));
    await waitOneFrame();
    expect(gs.getConverter()).to.equal(cv);
    promises.push(cv.convertToIModelCoords([[1, 1, 1]]));
    await waitOneFrame();
    expect(gs.getConverter()).to.equal(cv);
    promises.push(cv.convertFromIModelCoords([[2, 2, 2]]));
    await waitOneFrame();
    expect(gs.getConverter()).to.equal(cv);
    promises.push(cv.convertFromIModelCoords([[3, 3, 3]]));
    expect(gs.getConverter()).to.equal(cv);

    await Promise.all(promises);
    expect(gs.getConverter()).not.to.equal(cv);
  });

  it("resolves all requests to the same result if a request arrives while another request for same point is in flight", async () => {
    const resolveEvent = new BeEvent<() => void>();
    async function resolveOnEvent(numPoints: number): Promise<PointWithStatus[]> {
      return new Promise((resolve) => {
        const result: PointWithStatus[] = [];
        for (let i = 0; i < numPoints; i++)
          result.push({ p: [0, 0, 0], s: 0 });

        resolveEvent.addOnce(() => resolve(result));
      });
    }

    let curNumPoints = 1;
    const gs = makeGeoServices({
      toIModelCoords: async () => resolveOnEvent(curNumPoints++),
      fromIModelCoords: async () => resolveOnEvent(curNumPoints++),
    });

    const cv = gs.getConverter()!;
    const p1 = cv.convertToIModelCoords([[0, 0, 0]]);
    await waitOneFrame();
    resolveEvent.raiseEvent();

    const p2 = cv.convertToIModelCoords([[0, 0, 0]]);
    const r1 = await p1;
    expect(r1.length).to.equal(1);
    resolveEvent.raiseEvent();
    const r2 = await p2;
    expect(r2.length).to.equal(1);
  });

  it("removes converter from cache even if requests produce an exception", async () => {
    const gs = makeGeoServices({
      toIModelCoords: async () => { throw new Error("oh no!"); },
    });
    const cv = gs.getConverter()!;
    expect(gs.getConverter()).to.equal(cv);

    await cv.convertToIModelCoords([[0, 1, 2]]);
    const cv2 = gs.getConverter();
    expect(cv2).not.to.be.undefined;
    expect(cv2).not.to.equal(cv);
  });

  it("retains converter in cache if no requests are received", async () => {
    const gs = makeGeoServices();
    const cv = gs.getConverter()!;
    await BeDuration.wait(1);
    expect(gs.getConverter()).to.equal(cv);

    await cv.convertToIModelCoords([[0, 1, 2]]);
    expect(gs.getConverter()).not.to.equal(cv);
  });
});
