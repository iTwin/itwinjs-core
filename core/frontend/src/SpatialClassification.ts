/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SpatialClassification */
import { Id64String, Id64Arg, Id64, assert } from "@bentley/bentleyjs-core";
import { GeometricModelState } from "./ModelState";
import { IModelConnection } from "./IModelConnection";
import { SceneContext } from "./ViewContext";
import { BatchType } from "@bentley/imodeljs-common";
import { RenderClassifierModel, ClassifierType } from "./render/System";
import { IModelApp } from "./IModelApp";

/** Geometry may be classified by its spatial location.  This is typically used to classify reality models.
 * A volume classifier classifies on all space within a closed mesh.  A planar classifier classifies within a
 * planar region swept perpendicular to its plane.
 * @public
 */
export namespace SpatialClassification {
  /** Classification Type */
  export const enum Type { Planar = 0, Volume = 1 }

  /** Display modes */
  export const enum Display {
    /** If off, geometry is omitted (invisible) */
    Off = 0,
    /** If on geometry is displayed without alteration */
    On = 1,
    /** Dimmed geometry is darkened. */
    Dimmed = 2,
    /** Display tinted to hilite color */
    Hilite = 3,
    /** Display with the classifier color */
    ElementColor = 4,
  }

  /** Flag Properties */
  export interface FlagsProps {
    inside: SpatialClassification.Display;
    outside: SpatialClassification.Display;
    selected: SpatialClassification.Display;
    type: number;         // Not currently implemented
  }

  /** Flags */
  export class Flags implements FlagsProps {
    public inside: Display = Display.ElementColor;
    public outside: Display = Display.Dimmed;
    public selected: Display = Display.Hilite;
    public type: number = 0;         // Not currently implemented

    public constructor(inside = Display.ElementColor, outside = Display.Dimmed) { this.inside = inside; this.outside = outside; }
  }
  /** Properties describe a single application of a classifier to a model. */
  export interface PropertiesProps {
    /** The classifier model Id. */
    modelId: Id64String;
    /** a distance to expand the classification around the basic geometry.  Curve geometry is expanded to regions, regions are expanded to volumes. */
    expand: number;
    flags: Flags;
    name: string;
  }

  export class Properties implements PropertiesProps {
    public modelId: Id64String;
    public expand: number;
    public flags: Flags;
    public name: string;
    constructor(name: string, modelId: Id64String, expand: number, flags?: FlagsProps) {
      this.name = name;
      this.modelId = modelId;
      this.expand = expand;
      this.flags = flags ? flags : new Flags();
    }
  }

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
  export function getClassifierProps(model: GeometricModelState): Properties | undefined {
    if (model.jsonProperties.classifiers !== undefined) {
      for (const classifier of model.jsonProperties.classifiers) {
        if (classifier.isActive)
          return new Properties(classifier.name, classifier.modelId, classifier.expand, classifier.flags);

      }
    }
    return undefined;
  }

  /** @internal */
  export async function loadModelClassifiers(modelIdArg: Id64Arg, iModel: IModelConnection): Promise<void> {
    const modelIds = Id64.toIdSet(modelIdArg);
    const classifiersToLoad = [];
    for (const modelId of modelIds) {
      const model = iModel.models.getLoaded(modelId) as GeometricModelState;
      if (undefined !== model) {
        const props = getClassifierProps(model);
        if (undefined !== props) {
          classifiersToLoad.push(props.modelId);
        }
      }
    }
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
  export function addModelClassifierToScene(model: GeometricModelState, context: SceneContext): void {
    const classifierProps = getClassifierProps(model);
    if (undefined !== classifierProps) {
      const classifier = IModelApp.renderSystem.getSpatialClassificationModel(classifierProps.modelId, model.iModel);
      if (undefined !== classifier) {
        const classifierModel = model.iModel.models.getLoaded(classifierProps.modelId) as GeometricModelState;
        if (undefined !== classifierModel) {
          classifierModel.loadTileTree(classifier.type === ClassifierType.Planar ? BatchType.PlanarClassifier : BatchType.VolumeClassifier, false, undefined, classifierProps.expand);
          if (undefined === classifierModel.classifierTileTree)
            return;
          context.modelClassifiers.set(model.id, classifierProps.modelId);
          if (classifier.type === ClassifierType.Planar) {
            if (!context.getPlanarClassifier(classifierProps.modelId))
              context.setPlanarClassifier(classifierProps.modelId, IModelApp.renderSystem.createPlanarClassifier(classifierProps, classifierModel.classifierTileTree, model, context)!);
          } else {
            classifierModel.classifierTileTree.drawScene(context);
          }
        }
      }
    }
  }
}
