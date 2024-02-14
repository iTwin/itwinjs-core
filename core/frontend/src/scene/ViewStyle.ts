/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { FeatureAppearance, PlanProjectionSettings, PlanarClipMaskSettings, RealityModelDisplaySettings, SubCategoryOverride, ViewFlagsProperties } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { TileTreeReference } from "../tile/internal";

/** ###TODO optional properties have no effect. shadows, clipVolume, lighting, and thematicDisplay can't be enabled if they are globally disabled, I think.
 */
export type ViewStyleFlags = ViewFlagsProperties; // Optional<ViewFlagsProperties, "acsTriad" | "grid" | "backgroundMap" | "ambientOcclusion">;

export abstract class ViewStyle {
  /** @internal */
  protected constructor() { }

  abstract viewFlags: ViewStyleFlags;
  abstract get iModel(): IModelConnection;

  abstract planarClipMasks: Map<Id64String, PlanarClipMaskSettings>;

  // ###TODO renderTimeline Id and scheduleScriptProps

  abstract overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void;  
  abstract dropSubCategoryOverride(id: Id64String): void;  
  abstract get subCategoryOverrides(): ReadonlyMap<Id64String, Readonly<SubCategoryOverride>>;  
  abstract getSubCategoryOverride(id: Id64String): Readonly<SubCategoryOverride> | undefined;  
  abstract hasSubCategoryOverride(): boolean;

  abstract overrideModelAppearance(id: Id64String, ovr: FeatureAppearance): void;  
  abstract dropModelAppearanceOverride(id: Id64String): void;  
  abstract get modelAppearanceOverrides(): ReadonlyMap<Id64String, Readonly<FeatureAppearance>>;  
  abstract getModelAppearanceOverride(id: Id64String): Readonly<FeatureAppearance> | undefined;  
  abstract hasModelAppearanceOverride(): boolean;

  abstract getRealityModelDisplaySettings(modelId: Id64String): RealityModelDisplaySettings | undefined;
  abstract setRealityModelDisplaySettings(modelId: Id64String, settings: RealityModelDisplaySettings | undefined): void;

  abstract get excludedElementIds(): OrderedId64Iterable;
  abstract addExcludedElements(id: Id64String | Iterable<Id64String>): void;
  abstract dropExcludedElement(id: Id64String): void;
  abstract dropExcludedElements(id: Id64String | Iterable<Id64String>): void;
  abstract clearExcludedElements(): void;

  // ###TODO yuck
  abstract forEachTileTreeRef(func: (ref: TileTreeReference) => void): void;
  
  // ###TODO ClipStyle to override/replace Scene's style?

  get settings(): ViewStyle {
    return this;
  }

  is3d(): this is View3dStyle {
    return false;
  }
}

export abstract class View3dStyle extends ViewStyle {
  /** @internal */
  protected constructor() { super(); }

  override is3d(): this is View3dStyle {
    return true;
  }

  // ###TODO permit Scene's HiddenLine.Settings to be overridden/replaced?

  abstract getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
  abstract setPlanProjectionSettings(modelId: Id64String, settings: PlanProjectionSettings | undefined): void;
  abstract get planProjectionSettings(): Iterable<[Id64String, PlanProjectionSettings]> | undefined;
}
