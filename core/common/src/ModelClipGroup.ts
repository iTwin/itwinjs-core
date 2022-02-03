/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { ClipVectorProps } from "@itwin/core-geometry";
import { ClipVector } from "@itwin/core-geometry";

/** JSON representation of a [[ModelClipGroup]].
 * @public
 */
export interface ModelClipGroupProps {
  /** The Ids of the models in the group. */
  models?: Id64Array;
  /** JSON representation of the [ClipVector]($core-geometry) applied to the group. */
  clip?: ClipVectorProps;
}

/** Describes how to clip a group of models in the context of a [ViewDefinition3d]($backend) by applying a single [ClipVector]($core-geometry] to each model in the group.
 * @see [[ModelClipGroups]] to define multiple groups of models with different clip vectors.
 * @public
 */
export class ModelClipGroup {
  /** The Ids of the models to be clipped, or undefined if the group includes all models. */
  public readonly models?: Id64Array;
  /** The clip to apply to the group of models. `undefined` indicates the models are exempt from clipping. */
  public readonly clip?: ClipVector;

  private constructor(models: Id64Array | undefined, clip: ClipVector | undefined) {
    this.models = models;
    this.clip = clip;
  }

  /** Create a new ModelClipGroup. The input arguments are captured as references and should not be subsequently modified. */
  public static create(clip: ClipVector | undefined, models?: Id64Array): ModelClipGroup {
    return new ModelClipGroup(models, clip);
  }

  /** Create a deep copy of this group. */
  public clone(): ModelClipGroup {
    const models = this.models ? [...this.models] : undefined;
    return new ModelClipGroup(models, this.clip?.clone());
  }

  /** Returns whether the specified model Id belongs to this group. */
  public includesModel(modelId: Id64String): boolean {
    return undefined === this.models || this.models.includes(modelId);
  }

  /** Create from JSON representation. */
  public static fromJSON(props: ModelClipGroupProps): ModelClipGroup {
    const models = props.models ? [...props.models] : undefined;
    const clip = props.clip ? ClipVector.fromJSON(props.clip) : undefined;
    return new ModelClipGroup(models, undefined !== clip && clip.isValid ? clip : undefined);
  }

  /** Convert to JSON representation. */
  public toJSON(): ModelClipGroupProps {
    const props: ModelClipGroupProps = {};
    if (this.models)
      props.models = [...this.models];

    if (this.clip)
      props.clip = this.clip.toJSON();

    return props;
  }
}

/** Describes how to clip groups of models in the context of a [ViewDefinition3d]($backend) or [ViewState3d]($frontend).
 * Each group will be clipped by the [ClipVector]($core-geometry) associated with the group to which it belongs.
 * A model belongs to the first group in the list for which `ModelClipGroup.includesModel()` returns `true`.
 * A catch-all group can be defined by a ModelClipGroup with an `undefined` array of model Ids; any model whose Id does not appear in any group's list would belong to this group. If a catch-all group exists, it should appear last in the list.
 * A group of models can be exempted from clipping by a ModelClipGroup with an `undefined` ClipVector.
 * @note A ModelClipGroups obtained from a [[ViewDetails3d]] should **not** be modified directly. Clone it instead and modify the clone.
 * @see [[ViewDetails3d.modelClipGroups]] to define the clip groups for a [ViewDefinition3d]($backend) or [ViewState3d]($frontend).
 * @public
 */
export class ModelClipGroups {
  /** The groups of models and their associated clips. */
  public readonly groups: ModelClipGroup[];

  /** Create a new ModelClipGroups.
   * @note The ModelClipGroup takes ownership of the input array, which should not be subsequently modified.
   */
  public constructor(groups: ModelClipGroup[] = []) {
    this.groups = groups;
  }

  /** Create a deep copy of this ModelClipGroups. */
  public clone(): ModelClipGroups {
    const groups = this.groups.map((group) => group.clone());
    return new ModelClipGroups(groups);
  }

  /** Find the first group to which the specified model Id belongs, if any. */
  public findGroup(modelId: Id64String): ModelClipGroup | undefined {
    return this.groups.find((group) => group.includesModel(modelId));
  }

  /** Returns the array index of the group to which the specified model belongs, or -1 if the model belongs to no group. */
  public findGroupIndex(modelId: Id64String): number {
    return this.groups.findIndex((group) => group.includesModel(modelId));
  }

  /** Find the clip that should be applied to the specified model.
   * @note This may return `undefined` if the model belongs to no group, **or** it belongs to a group that should not be clipped.
   */
  public getClipForModel(modelId: Id64String): ClipVector | undefined {
    return this.findGroup(modelId)?.clip;
  }

  /** Create from JSON representation. */
  public static fromJSON(props: ModelClipGroupProps[] | undefined): ModelClipGroups {
    const groups = props?.map((prop) => ModelClipGroup.fromJSON(prop));
    return new ModelClipGroups(groups);
  }

  /** Convert to JSON representation. */
  public toJSON(): ModelClipGroupProps[] {
    return this.groups.map((group) => group.toJSON());
  }
}
