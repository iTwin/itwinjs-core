/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { RealityTileTree, TileTreeReference, Viewport } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ GetBatchTableFeatureProperties

/** Given a viewport that is displaying one or more context reality models and the Id of a feature within one of those models' batch tables,
 * return the JSON properties associated with that feature.
 * @beta
 */
export function getBatchTableFeatureProperties(featureId: Id64String, viewport: Viewport): Record<string, any> | undefined {
  let featureProperties: Record<string, any> | undefined;

  // Iterate the TileTreeReferences of the ContextRealityModels associated with the viewport to find the properties of the specified feature.
  viewport.displayStyle.forEachRealityTileTreeRef((ref: TileTreeReference) => {
    if (featureProperties) {
      // We've already found the properties
      return;
    }

    const tree = ref.treeOwner.tileTree;

    // Only RealityTileTrees have batch tables.
    const batchTableProperties = tree instanceof RealityTileTree ? tree.batchTableProperties : undefined;
    featureProperties = batchTableProperties?.getFeatureProperties(featureId);
  });

  return featureProperties;
}

// __PUBLISH_EXTRACT_END__
