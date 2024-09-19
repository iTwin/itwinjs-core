/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, IModelConnection, readGltfTemplate, RenderGraphic, RenderInstancesParamsBuilder } from "@itwin/core-frontend";
import { Point3d, Transform } from "@itwin/core-geometry";

// __PUBLISH_EXTRACT_START__
/** Create a graphic that renders the specified glTF model at multiple positions.
 * @param gltf The raw glTF describing the model.
 * @param positions The locations at which to draw each instance of the model.
 * @param iModel The iModel to be associated with the graphic.
 */
export async function instanceGltfModel(gltf: Uint8Array | object, positions: Point3d[], iModel: IModelConnection): Promise<RenderGraphic> {
  // Decode the raw glTF as an instanceable  template.
  const template = (await readGltfTemplate({ gltf, iModel }))?.template;
  if (!template) {
    throw new Error("Failed to decode glTF model.");
  }

  // Generate an Id for a "model" to contain the instances.
  const modelId = iModel.transientIds.getNext();

  // Define multiple instances, one at each of the specified positions.
  const instancesBuilder = RenderInstancesParamsBuilder.create({ modelId });
  for (const position of positions) {
    instancesBuilder.add({
      // Translate to the specified position.
      transform: Transform.createTranslation(position),
      // Assign a unique pickable Id.
      feature: iModel.transientIds.getNext(),
    });
  }

  const instancesParams = instancesBuilder.finish();
  const instances = IModelApp.renderSystem.createRenderInstances(instancesParams);

  // Create a graphic that associates the instances with the template.
  return IModelApp.renderSystem.createGraphicFromTemplate({ template, instances });
}
// __PUBLISH_EXTRACT_END__
