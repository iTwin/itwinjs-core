/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GraphicType, IModelApp, TileTreeReference, Viewport } from "@itwin/core-frontend";
import { Point3d, Sphere } from "@itwin/core-geometry";

// __PUBLISH_EXTRACT_START__ TileTreeReference_createFromRenderGraphic

/** Add a TiledGraphicsProvider to draw a sphere into the specified viewport. */
export function addTiledGraphics(viewport: Viewport): void {
  // Create a scene graphic with a 1cm chord tolerance.
  const builder = IModelApp.renderSystem.createGraphic({
    type: GraphicType.Scene,
    computeChordTolerance: () => 0.01,
  });

  // Produce the sphere graphic.
  builder.addSolidPrimitive(Sphere.createCenterRadius(new Point3d(0, 0, 0), 20));
  const graphic = builder.finish();

  // Create a TileTreeReference to draw the sphere.
  const treeRef = TileTreeReference.createFromRenderGraphic({
    graphic,
    modelId: viewport.iModel.transientIds.getNext(),
    iModel: viewport.iModel,
  });

  // Register a provider to draw the sphere as part of the viewport's scene.
  viewport.addTiledGraphicsProvider({
    forEachTileTreeRef: (_vp, func) => func(treeRef),
  });
}

// __PUBLISH_EXTRACT_END__

