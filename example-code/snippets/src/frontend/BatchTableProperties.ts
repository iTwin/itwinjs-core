/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@itwin/core-bentley";
import { RealityTileTree, Viewport } from "@itwin/core-frontend";

// __PUBLISH_EXTRACT_START__ GetBatchTableFeatureProperties

/** Given a viewport that is displaying one or more context reality models and the Id of a feature within one of those models' batch tables,
 * return the JSON properties associated with that feature.
 * @beta
 */
export function getBatchTableFeatureProperties(featureId: Id64String, viewport: Viewport): Record<string, any> | undefined {
  // Iterate the viewport's context reality models to find the one to which the specified feature belongs.
  for (const model of viewport.displayStyle.realityModels) {
    const tree = model.treeRef.treeOwner.tileTree;

    // Only RealityTileTrees have batch tables, hence the `instanceof` check.
    const batchTableProperties = tree instanceof RealityTileTree ? tree.batchTableProperties : undefined;
    const featureProperties = batchTableProperties?.getFeatureProperties(featureId);
    if (featureProperties)
      return featureProperties;
  }

  // The specified feature was not found in any context reality model's batch table.
  return undefined;
}

// __PUBLISH_EXTRACT_END__
