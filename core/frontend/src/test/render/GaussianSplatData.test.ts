/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { GaussianSplatSpzRequest } from "../../internal/render/GaussianSplatData";
import { decodeGaussianSplats } from "../../internal/render/GaussianSplatWorker";
import { packGaussianSplats } from "../../workers/GaussianSplats/Packing";
import {
  gaussianSplatDraftGlb, gaussianSplatFixture, gaussianSplatGlb, gaussianSplatSpz, readGaussianSplatGlb, unpackGaussianSplat, unpackGaussianSplatSh,
} from "./GaussianSplatFixtures";

const notCanceled = () => false;

/** A decode request for an SPZ payload of degree 1 in the ratified extension's layout. */
function spzRequest(spz: Uint8Array, count: number): GaussianSplatSpzRequest {
  return { format: "spz", spz, count, shDegree: 1, colorSpace: "srgb_rec709_display", draftLayout: false };
}

describe("Gaussian splat decoding", () => {
  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  it("decodes an independent SPZ 2 golden payload", async () => {
    const result = (await decodeGaussianSplats(spzRequest(await gaussianSplatSpz(), 1), notCanceled))!;

    expect(result.count).toBe(1);
    expect(result.shDegree).toBe(1);
    // The payload's mean is (1, 2, 3) in SPZ's axes; glTF's axes negate x and z.
    expect(result.origin).toEqual([-1, 2, -3]);
    const splat = unpackGaussianSplat(result.data, 0);
    expect(splat.opacity).toBe(16 * 128 / 4080);
    expect(splat.covariance).toEqual([1, 0, 0, 1, 0, 1].map((value) => expect.closeTo(value, 9)));
    expect(splat.dc).toEqual([140, 128, 116].map((byte) => expect.closeTo((byte / 255 - 0.5) / 0.15, 6)));
    // SPZ's color and scale bytes land exactly on the packed grids.
    expect([(result.data[6] >>> 16) & 0xfff, result.data[7] & 0xfff, (result.data[7] >>> 12) & 0xfff]).toEqual([140, 128, 116].map((byte) => 8 * byte + 1024));
    expect([result.data[5] & 0xffff, result.data[5] >>> 16, result.data[6] & 0xffff]).toEqual([160, 160, 160].map((byte) => 64 * byte + 22528));
    expect(unpackGaussianSplatSh(result, 0)).toEqual(Array.from({ length: 9 }, (_, k) => (k + 1) / 128 * (k < 3 ? 1 : -1)));
  });

  it("reads the ratified extension's attributes and Cesium ion's draft SPZ content from glTF", async () => {
    const source = gaussianSplatFixture(3, 2);
    source.positions.set([1, 2, 3, -4, 5, -6]);
    source.sh.set([0.5, -0.25, 0.125], 48 + 3);

    const ratified = await decodeGaussianSplats(readGaussianSplatGlb(gaussianSplatGlb(source)), notCanceled);

    // Degree 2 has 9 of the 16 coefficients per color channel that the source has room for.
    expect(ratified).toEqual(packGaussianSplats({ ...source, sh: source.sh.filter((_, k) => k % 48 < 27) }));

    const draftRequest = readGaussianSplatGlb(gaussianSplatDraftGlb(await gaussianSplatSpz(1, 1, 3), 1, 1));
    expect(draftRequest).toMatchObject({ format: "spz", draftLayout: true });

    const draft = await decodeGaussianSplats(draftRequest, notCanceled);

    // As CesiumJS decodes it: in SPZ's own axes, sorted by view depth.
    expect(draft).toMatchObject({ count: 1, origin: [1, 2, 3], sortingMethod: "viewDepth" });
  });

  it("rejects malformed SPZ, and keeps decoding", async () => {
    await expect(decodeGaussianSplats(spzRequest(new Uint8Array([1, 2, 3]), 1), notCanceled)).rejects.toThrow();
    await expect(decodeGaussianSplats(spzRequest(await gaussianSplatSpz(), 2), notCanceled)).rejects.toThrow(/does not match/);

    expect((await decodeGaussianSplats(spzRequest(await gaussianSplatSpz(), 1), notCanceled))?.count).toBe(1);
  });
});
