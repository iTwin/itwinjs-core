/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SpatialClassification */
import { Id64String, Id64Arg, Id64, assert } from "@bentley/bentleyjs-core";
import { GeometricModelState, TileTreeModelState } from "./ModelState";
import { IModelConnection } from "./IModelConnection";
import { SceneContext } from "./ViewContext";
import { BatchType, SpatialClassificationProps } from "@bentley/imodeljs-common";
import { RenderClassifierModel, ClassifierType } from "./render/System";
import { IModelApp } from "./IModelApp";

/** Geometry may be classified by its spatial location.  This is typically used to classify reality models.
 * A volume classifier classifies on all space within a closed mesh.  A planar classifier classifies within a
 * planar region swept perpendicular to its plane.
 * @beta
 */
export namespace SpatialClassification {

  /** @internal */
  async function usePlanar(model: GeometricModelState): Promise<boolean> {
    const range = await model.queryModelRange();
    const depthMax = 1.0E-2;
    return range.high.z - range.low.z < depthMax;
  }

  /** @internal */
  export async function createClassifier(id: Id64String, iModel: IModelConnection): Promise<RenderClassifierModel | undefined> {
    const classifierModel = iModel.models.getLoaded(id) as GeometricModelState;
    if (undefined === classifierModel) {
      assert(false, "classifier not loaded");
      return undefined;
    }
    return new RenderClassifierModel(await usePlanar(classifierModel) ? ClassifierType.Planar : ClassifierType.Volume);
  }

  /** @internal */
  export function getClassifierProps(model: TileTreeModelState): SpatialClassificationProps.Properties | undefined {
    if (model.jsonProperties.classifiers !== undefined) {
      for (const classifier of model.jsonProperties.classifiers) {
        if (classifier.isActive)
          return new SpatialClassificationProps.Properties(classifier);

      }
    }
    return undefined;
  }

  /** @internal */
  export async function loadModelClassifiers(modelIdArg: Id64Arg, iModel: IModelConnection): Promise<void> {
    const classifiersToLoad = new Set<string>();
    Id64.forEach(modelIdArg, (modelId) => {
      const model = iModel.models.getLoaded(modelId) as GeometricModelState;
      if (undefined !== model) {
        const props = getClassifierProps(model);
        if (undefined !== props)
          classifiersToLoad.add(props.modelId);
      }
    });

    return loadClassifiers(classifiersToLoad, iModel);
  }
  /** @internal */
  export async function loadClassifiers(classifierIdArg: Id64Arg, iModel: IModelConnection): Promise<void> {
    const classifierIds = Id64.toIdSet(classifierIdArg);
    await iModel.models.load(classifierIds).then(async (_) => {
      for (const classifierId of classifierIds)
        await SpatialClassification.createClassifier(classifierId, iModel).then((classifier) => { if (classifier) IModelApp.renderSystem.addSpatialClassificationModel(classifierId, classifier, iModel); });
    });
  }
  /** @internal */
  export function addModelClassifierToScene(classifiedModel: TileTreeModelState, context: SceneContext): void {
    const classifierProps = getClassifierProps(classifiedModel);
    if (undefined !== classifierProps) {
      const classifier = IModelApp.renderSystem.getSpatialClassificationModel(classifierProps.modelId, classifiedModel.iModel);
      if (undefined !== classifier) {
        const classifierModel = classifiedModel.iModel.models.getLoaded(classifierProps.modelId) as GeometricModelState;
        if (undefined !== classifierModel) {
          const isPlanar = ClassifierType.Planar === classifier.type;
          const batchType = isPlanar ? BatchType.PlanarClassifier : BatchType.VolumeClassifier;

          classifierModel.loadClassifierTileTree(batchType, classifierProps.expand);
          if (undefined === classifierModel.classifierTileTree)
            return;

          context.modelClassifiers.set(classifiedModel.treeModelId, classifierProps.modelId);
          if (isPlanar) {
            if (!context.getPlanarClassifier(classifierProps.modelId))
              context.setPlanarClassifier(classifierProps.modelId, IModelApp.renderSystem.createPlanarClassifier(classifierProps, classifierModel.classifierTileTree, classifiedModel, context)!);
          } else {
            classifierModel.classifierTileTree.drawScene(context);
          }
        }
      }
    }
  }
  /**   Get active spatial classifier
   * @beta
   */
  export function getActiveSpatialClassifier(model: TileTreeModelState): number {
    if (model.jsonProperties !== undefined && model.jsonProperties.classifiers !== undefined) {
      for (let index = 0; index < model.jsonProperties.classifiers.length; index++) {
        if (model.jsonProperties.classifiers[index].isActive)
          return index;
      }
    }
    return -1;
  }
  /** Get spatial classifier at  index
   * @beta
   */
  export function getSpatialClassifier(model: TileTreeModelState, index: number): SpatialClassificationProps.Properties | undefined {
    if (index < 0 || undefined === model.jsonProperties.classifiers || index >= model.jsonProperties.classifiers.length)
      return undefined;

    return new SpatialClassificationProps.Properties(model.jsonProperties.classifiers[index]);
  }
  /** Set the spatial classifier at index
   * @beta
   */
  export function setSpatialClassifier(model: TileTreeModelState, index: number, classifier: SpatialClassificationProps.Properties) {
    if (index < 0 || undefined === model.jsonProperties.classifiers || index >= model.jsonProperties.classifiers.length)
      return;

    model.jsonProperties.classifiers[index] = classifier;
  }
  /** Set the active spatial classifier by index
   * @beta
   */
  export async function setActiveSpatialClassifier(model: TileTreeModelState, classifierIndex: number, active: boolean) {
    const classifiers = model.jsonProperties.classifiers;
    if (classifiers !== undefined)
      for (let index = 0; index < classifiers.length; index++)
        if (false !== (classifiers[index].isActive = (classifierIndex === index && active)))
          await SpatialClassification.loadModelClassifiers(model.treeModelId, model.iModel);
  }

  /** Add a spatial classifier
   * @beta
   */
  export function addSpatialClassifier(model: TileTreeModelState, classifier: SpatialClassificationProps.PropertiesProps) {
    if (undefined === model.jsonProperties.classifiers)
      model.jsonProperties.classifiers = [];

    model.jsonProperties.classifiers.push(classifier);
  }
}
