/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { ColorDef, SpatialClassifierFlags } from "@itwin/core-common";
import { ContextRealityModelState, GraphicType, IModelApp, TileTreeReference, Viewport } from "@itwin/core-frontend";
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

// __PUBLISH_EXTRACT_START__ TileTreeReference_DynamicClassifier

/** A spatial region described by a bounding sphere, used to classify a reality model. */
interface ClassifiedRegion {
  /** The center point of the bounding sphere. */
  center: Point3d;
  /** The radius of the bounding sphere. */
  radius: number;
  /** The name of the region, to serve as a tooltip when the user hovers over the classified region of the reality model. */
  name: string;
  /** The color in which to draw the classified region of the reality model. */
  color: ColorDef;
}

/** Classify spherical regions of a reality model, either by planar projection (`classifyByVolume=false`) or by bounding volume (`classifyByVolume=true`). */
export function classifyRealityModel(model: ContextRealityModelState, regions: ClassifiedRegion[], classifyByVolume: boolean): void {
  const modelId = model.iModel.transientIds.getNext();

  // Create a GraphicBuilder to define the classifier geometry.
  const builder = IModelApp.renderSystem.createGraphic({
    type: GraphicType.Scene,
    computeChordTolerance: () => 0.01,
    pickable: {
      modelId,
      id: modelId,
      isVolumeClassifier: classifyByVolume,
    },
  });

  const regionIdsAndNames: Array<{ name: string, id: Id64String }> = [];

  for (const region of regions) {
    // Assign a unique Id to each region, so we can identify them when the user interacts with them in a viewport.
    const regionId = model.iModel.transientIds.getNext();
    regionIdsAndNames.push({ id: regionId, name: region.name });

    // Add a sphere representing the region.
    builder.setSymbology(region.color, region.color, 1);
    builder.activatePickableId(regionId);
    builder.addSolidPrimitive(Sphere.createCenterRadius(region.center, region.radius));
  }

  // Create a tile tree reference to provide the graphics at display time.
  const tileTreeReference = TileTreeReference.createFromRenderGraphic({
    graphic: builder.finish(),
    modelId,
    iModel: model.iModel,
    getToolTip: async (hit) => Promise.resolve(regionIdsAndNames.find((x) => x.id === hit.sourceId)?.name),
  });

  // Direct the reality model to use our tile tree reference for classification.
  model.classifiers.activeClassifier = {
    tileTreeReference,
    name: "Regions",
    flags: new SpatialClassifierFlags(undefined, undefined, classifyByVolume),
  };
}

// __PUBLISH_EXTRACT_END__
