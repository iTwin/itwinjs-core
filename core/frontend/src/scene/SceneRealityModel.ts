/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { FeatureAppearance, RealityDataSourceKey, RealityModelDisplaySettings } from "@itwin/core-common";
import { GuidString, Id64String } from "@itwin/core-bentley";

export interface ModelClassifierParams {
  readonly type: "model";
  readonly modelId: Id64String;
  readonly expand: number; // default 0
}

export type SceneObjectClassifierParams = ModelClassifierParams | {
  readonly type: unknown;
};

export interface SceneObjectClassifier {
  readonly source: GuidString;
  readonly name: string;
  readonly inside: "on" | "off" | "dimmed" | "hilite" | "source";
  readonly outside: "on" | "off" | "dimmed";
  readonly isVolume: boolean;
  readonly params?: SceneObjectClassifierParams;
}

export interface SceneObjectClassifiers extends Iterable<SceneObjectClassifier> {
  active: SceneObjectClassifier | undefined;
  readonly size: number;
  find(criterion: (classifier: SceneObjectClassifier) => boolean): SceneObjectClassifier | undefined;
  findEquivalent(classifier: SceneObjectClassifier): SceneObjectClassifier | undefined;
  has(classifier: SceneObjectClassifier): boolean;
  add(classifier: SceneObjectClassifier): SceneObjectClassifier;
  replace(toReplace: SceneObjectClassifier, replaceWith: SceneObjectClassifier): boolean;
  delete(classifier: SceneObjectClassifier): SceneObjectClassifier | undefined;
  clear(): void;
}

export interface ModelClipMaskParams {
  readonly type: "imodel";
  readonly models: Iterable<Id64String>;
  readonly elements?: never;
  readonly subCategories?: never;
}

export interface SubCategoryClipMaskParams {
  readonly type: "imodel";
  readonly models?: Iterable<Id64String>;
  readonly subCategories: Iterable<Id64String>;
  readonly elements?: never;
}

export interface ElementClipMaskParams {
  readonly type: "imodel";
  readonly models?: Iterable<Id64String>;
  readonly elements: Iterable<Id64String>;
  readonly exclude?: boolean;
  readonly subCategories?: never;
}

export type IModelClipMaskParams = ModelClipMaskParams | SubCategoryClipMaskParams | ElementClipMaskParams;
export type ClipMaskParams = IModelClipMaskParams | { type: unknown };

export interface SceneObjectClipMask {
  readonly source: GuidString;
  readonly params?: ClipMaskParams;
}
export interface BaseClipMaskSettings {
  readonly invert: boolean;
  readonly transparency?: number;
}

export interface PriorityClipMaskSettings extends BaseClipMaskSettings {
  readonly priority: number;
  readonly mask?: never;
}

export interface SceneObjectClipMaskSettings extends BaseClipMaskSettings {
  readonly mask: SceneObjectClipMask;
  readonly priority?: never;
}

export type ClipMaskSettings = PriorityClipMaskSettings | SceneObjectClipMaskSettings;

export interface SceneRealityModel {
  readonly sourceKey: RealityDataSourceKey;
  readonly name: string;
  readonly description: string;
  readonly realityDataId?: string;
  readonly classifiers: SceneObjectClassifiers;
  clipMask?: ClipMaskSettings;
  appearanceOverrides?: FeatureAppearance;
  displaySettings: RealityModelDisplaySettings;
  // ###TODO Is this actually needed, or just confusing?
  // readonly modelId: Id64String;
}
