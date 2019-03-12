/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module WebGL */
import { Id64String, Id64Arg, Id64, assert } from "@bentley/bentleyjs-core";
import { GeometricModelState } from "./ModelState";
import { IModelConnection } from "./IModelConnection";
import { SceneContext } from "./ViewContext";
import { BatchType } from "@bentley/imodeljs-common";
import { RenderClassifierModel, ClassifierType } from "./render/System";
import { System } from "./render/webgl/System";
import { PlanarClassifier } from "./render/webgl/PlanarClassifier";

export namespace Classification {
  export const enum Display { Off = 0, On = 1, Dimmed = 2, Hilite = 3, ElementColor = 4 }
  export interface FlagsProps {
    inside: Display;
    outside: Display;
    selected: Display;
    type: number;         // Not currently implemented
  }
  export class Flags implements FlagsProps {
    public inside: Display = Display.ElementColor;
    public outside: Display = Display.Dimmed;
    public selected: Display = Display.Hilite;
    public type: number = 0;         // Not currently implemented
  }
  export class Properties {
    public id: Id64String;
    public expansion: number;
    public flags: Flags;
    constructor(id: Id64String, expansion: number, flags?: FlagsProps) {
      this.id = id;
      this.expansion = expansion;
      this.flags = flags ? flags : new Flags();
    }
  }

  async function usePlanar(model: GeometricModelState): Promise<boolean> {
    const range = await model.queryModelRange();
    const depthMax = 1.0E-2;
    return range.high.z - range.low.z < depthMax;
  }

  export async function createClassifier(id: Id64String, iModel: IModelConnection): Promise<RenderClassifierModel | undefined> {
    const classifierModel = iModel.models.getLoaded(id) as GeometricModelState;
    if (undefined === classifierModel) {
      assert(false, "classifier not loaded");
      return undefined;
    }
    return new RenderClassifierModel(await usePlanar(classifierModel) ? ClassifierType.Planar : ClassifierType.Volume);
  }

  export function getClassifierProps(model: GeometricModelState): Properties | undefined {
    if (model.jsonProperties.classifiers !== undefined) {
      for (const classifier of model.jsonProperties.classifiers) {
        if (classifier.isActive)
          return new Properties(classifier.modelId, classifier.expand, classifier.flags);

      }
    }
    return undefined;
  }

  export async function loadModelClassifiers(modelIdArg: Id64Arg, iModel: IModelConnection): Promise<void> {
    const modelIds = Id64.toIdSet(modelIdArg);
    const classifiersToLoad = [];
    for (const modelId of modelIds) {
      const model = iModel.models.getLoaded(modelId) as GeometricModelState;
      if (undefined !== model) {
        const props = getClassifierProps(model);
        if (undefined !== props) {
          classifiersToLoad.push(props.id);
        }
      }
    }
    return loadClassifiers(classifiersToLoad, iModel);
  }
  export async function loadClassifiers(classifierIdArg: Id64Arg, iModel: IModelConnection): Promise<void> {
    const classifierIds = Id64.toIdSet(classifierIdArg);
    await iModel.models.load(classifierIds).then(async (_) => {
      for (const classifierId of classifierIds)
        await Classification.createClassifier(classifierId, iModel).then((classifier) => { if (classifier) System.instance.addClassifier(classifierId, classifier, iModel); });
    });
  }
  export function addModelClassifierToScene(model: GeometricModelState, context: SceneContext): void {
    const classifierProps = getClassifierProps(model);
    if (undefined !== classifierProps) {
      const classifier = System.instance.getClassifier(classifierProps.id, model.iModel);
      if (undefined !== classifier) {
        const classifierModel = model.iModel.models.getLoaded(classifierProps.id) as GeometricModelState;
        if (undefined !== classifierModel) {
          classifierModel.loadTileTree(classifier.type === ClassifierType.Planar ? BatchType.PlanarClassifier : BatchType.VolumeClassifier, false, undefined, classifierProps.expansion);
          if (undefined === classifierModel.classifierTileTree)
            return;
          context.modelClassifiers.set(model.id, classifierProps.id);
          if (classifier.type === ClassifierType.Planar) {
            if (!context.getPlanarClassifier(classifierProps.id))
              context.setPlanarClassifier(classifierProps.id, PlanarClassifier.create(classifierProps, classifierModel.classifierTileTree, model, context));
          } else {
            classifierModel.classifierTileTree.drawScene(context);
          }
        }
      }
    }
  }
}
