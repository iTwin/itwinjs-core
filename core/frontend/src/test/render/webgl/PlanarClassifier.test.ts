/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Point3d, Range2d, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { BlankConnection } from "../../../IModelConnection";
import { SpatialViewState } from "../../../SpatialViewState";
import { OffScreenViewport } from "../../../Viewport";
import { ViewRect } from "../../../common/ViewRect";
import { MeshMapLayerGraphicParams } from "../../../internal/render/MeshMapLayerGraphicParams";
import { LayerTextureParams, ProjectedTexture } from "../../../internal/render/webgl/MapLayerParams";
import { PlanarClassifier } from "../../../internal/render/webgl/PlanarClassifier";
import { Target } from "../../../internal/render/webgl/Target";
import { Texture } from "../../../internal/render/webgl/Texture";
import { createBlankConnection } from "../../createBlankConnection";

describe("PlanarClassifier", () => {
  let imodel: BlankConnection;

  beforeAll(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection();
  });

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  function createViewport(size: number): OffScreenViewport {
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Point3d(1, 1, 1));
    return OffScreenViewport.create({ view, viewRect: new ViewRect(0, 0, size, size) });
  }

  /** Run the classifier's per-frame sizing against the viewport's current dimensions. No classifier or mask source is set, so
   * collectGraphics returns right after sizing the texture.
   */
  function collect(classifier: PlanarClassifier, vp: OffScreenViewport): void {
    classifier.collectGraphics(vp.createSceneContext(), { modelId: "0x1c", tiles: [], location: Transform.createIdentity(), isPointCloud: false });
  }

  function textureWidth(classifier: PlanarClassifier): number | undefined {
    return classifier.classifierTexture?.texture.width;
  }

  it("sizes the texture to 4 texels per view pixel in multiples of 256, capped at maxTexSizeAllow", () => {
    const maxTexSizeAllow = (IModelApp.renderSystem as unknown as { maxTexSizeAllow: number }).maxTexSizeAllow;
    for (const [viewSize, expected] of [[100, 512], [512, 2048], [513, 2304], [1024, 4096], [2000, 4096]]) {
      using vp = createViewport(viewSize);
      using classifier = (vp.target as Target).createPlanarClassifier(undefined);
      collect(classifier, vp);
      classifier.getOrCreateClassifierTexture();
      expect(textureWidth(classifier), `view size ${viewSize}`).toEqual(Math.min(expected, maxTexSizeAllow));
    }
  });

  it("does not allocate the classifier texture when it is looked up for binding", () => {
    using vp = createViewport(100);
    using classifier = (vp.target as Target).createPlanarClassifier(undefined);
    collect(classifier, vp);
    expect(classifier.classifierTexture).toBeUndefined();
    expect(classifier.isDisposed).toBe(true);
  });

  it("rebinds draped model layers to the replacement texture when the view resizes", () => {
    using vp = createViewport(512);
    using classifier = (vp.target as Target).createPlanarClassifier(undefined);
    collect(classifier, vp);

    // Geometry for a draped model map layer is built once and retained across frames.
    const projected = new ProjectedTexture(classifier, {} as MeshMapLayerGraphicParams, Range2d.createXYXY(0, 0, 1, 1));
    using params = LayerTextureParams.create([projected]);
    const original = params.params[0].texture as Texture;
    expect(original).toBeDefined();
    expect(original.texture.width).toEqual(2048);

    // Crossing a 256-texel bucket boundary (512 -> 513 px is 2048 -> 2304 texels) recreates the classifier's texture.
    vp.setRect(new ViewRect(0, 0, 513, 513));
    collect(classifier, vp);
    expect(original.isDisposed).toBe(true);
    expect(params.params[0].texture).toBeUndefined();

    // The classifier recreates its buffers when it next draws; the retained geometry must bind that texture, not the disposed one.
    const replacement = classifier.getOrCreateClassifierTexture();
    expect(replacement).toBeDefined();
    expect(replacement!.texture.width).toEqual(2304);
    expect(params.params[0].texture).toBe(replacement);
  });

  it("does not dispose the classifier's texture when draped geometry is disposed", () => {
    using vp = createViewport(100);
    using classifier = (vp.target as Target).createPlanarClassifier(undefined);
    collect(classifier, vp);
    const projected = new ProjectedTexture(classifier, {} as MeshMapLayerGraphicParams, Range2d.createXYXY(0, 0, 1, 1));
    const params = LayerTextureParams.create([projected]);
    const texture = classifier.classifierTexture;
    expect(texture).toBeDefined();

    params[Symbol.dispose]();
    expect(texture!.isDisposed).toBe(false);
    expect(classifier.classifierTexture).toBe(texture);
  });

  it("resizing keeps the classifier in use rather than disposing it", () => {
    using vp = createViewport(512);
    using classifier = (vp.target as Target).createPlanarClassifier(undefined);
    let sourceDisposed = 0;
    (classifier as any)._featureSymbologySource.onSourceDisposed.addListener(() => ++sourceDisposed);

    collect(classifier, vp);
    classifier.getOrCreateClassifierTexture();
    vp.setRect(new ViewRect(0, 0, 513, 513));
    collect(classifier, vp);
    expect(sourceDisposed).toEqual(0);

    classifier[Symbol.dispose]();
    expect(sourceDisposed).toEqual(1);
  });

  it("disposes the combination buffers' viewport-quad geometry", () => {
    using vp = createViewport(100);
    const classifier = (vp.target as Target).createPlanarClassifier(undefined);
    collect(classifier, vp);
    classifier.getOrCreateClassifierTexture();
    const geometry = (classifier as any)._classifierCombinedBuffer._combineGeom;
    expect(geometry.isDisposed).toBe(false);

    classifier[Symbol.dispose]();
    expect(geometry.isDisposed).toBe(true);
  });
});
