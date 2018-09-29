/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { RenderOrder, isPlanar, isSurface } from "@bentley/imodeljs-frontend/lib/webgl";

describe("RenderFlags", () => {
  it("isPlanar should return true if given RenderOrder is greater than or equal to PlanarBit", () => {
    assert.isTrue(isPlanar(RenderOrder.PlanarBit), "PlanarBit is Planar");
    assert.isTrue(isPlanar(RenderOrder.PlanarSurface), "PlanarSurface is Planar");
    assert.isTrue(isPlanar(RenderOrder.PlanarLinear), "PlanarLinear is Planar");
    assert.isTrue(isPlanar(RenderOrder.PlanarEdge), "PlanarEdge is Planar");
    assert.isTrue(isPlanar(RenderOrder.PlanarSilhouette), "PlanarSilhouette is Planar");
    assert.isFalse(isPlanar(RenderOrder.None), "None is not a Planar");
    assert.isFalse(isPlanar(RenderOrder.BlankingRegion), "BlankingRegion is not a Planar");
    assert.isFalse(isPlanar(RenderOrder.Surface), "Surface is not a Planar");
    assert.isFalse(isPlanar(RenderOrder.Linear), "Linear is not a Planar");
    assert.isFalse(isPlanar(RenderOrder.Edge), "Edge is not a Planar");
    assert.isFalse(isPlanar(RenderOrder.Silhouette), "Silhouette is not a Planar");
  });
  it("isSurface should return true if given RenderOrder is less than or equal to Surface or equal to PlanarSurface", () => {
    assert.isTrue(isSurface(RenderOrder.None), "None is Surface");
    assert.isTrue(isSurface(RenderOrder.BlankingRegion), "BlankingRegion is Surface");
    assert.isTrue(isSurface(RenderOrder.PlanarSurface), "PlanarSurface is Surface");
    assert.isFalse(isSurface(RenderOrder.Linear), "Linear is not a Surface");
    assert.isFalse(isSurface(RenderOrder.Edge), "Edge is not a Surface");
    assert.isFalse(isSurface(RenderOrder.Silhouette), "Silhouette is not a Surface");
    assert.isFalse(isSurface(RenderOrder.PlanarBit), "PlanarBit is not a Surface");
    assert.isFalse(isSurface(RenderOrder.PlanarLinear), "PlanarLinear is not a Surface");
    assert.isFalse(isSurface(RenderOrder.PlanarEdge), "PlanarEdge is not a Surface");
    assert.isFalse(isSurface(RenderOrder.PlanarSilhouette), "PlanarSilhouette is not a Surface");
  });
});
