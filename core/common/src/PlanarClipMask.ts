/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import { CompressedId64Set, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";

/** The different modes by which a [[PlanarClipMaskSettings]] collects the geometry used to mask a model.
 * @public
 */
export enum PlanarClipMaskMode {
  /** No masking. */
  None = 0,
  /** Mask based on priority. Different types of models have different default priorities as enumerated by [[PlanarClipMaskPriority]].
   * For example, background maps have the lowest priority, so they are masked by all other types, while design models have the highest priority and are therefore never masked.
   * The priority of a reality model can be overridden by [[PlanarClipMaskSettings.priority]]. This is useful to allow one reality model to mask another overlapping one.
   */
  Priority = 1,
  /** Indicates that masks should be produced from the geometry in a set of [GeometricModel]($backend)s. */
  Models = 2,
  /** Indicates that masks should be produced from geometry belonging to a set of subcategories. */
  IncludeSubCategories = 3,
  /** Indicates that masks should be produced from the geometry of a set of [GeometricElement]($backend)s. */
  IncludeElements = 4,
  /** Indicates that masks should be produced from the geometry of all [GeometricElement]($backend)s in a view, **except** for a specified set of excluded elements. */
  ExcludeElements = 5,
}

/** The default priority values for a [[PlanarClipMaskSettings]], based on model type. Models with a lower priority are masked by models with a higher priority.
 * The default can be overridden by [[PlanarClipMaskSettings.priority]].
 *  @public
 */
export enum PlanarClipMaskPriority {
  /** Background map. */
  BackgroundMap = -2048,
  /** A reality model that spans the globe - e.g., OpenStreetMaps Buildings. */
  GlobalRealityModel = -1024,
  /** A reality model with a bounded range. */
  RealityModel = 0,
  /** A design model stored in the [IModelDb]($backend). */
  DesignModel = 2048,
}

/** JSON representation of a [[PlanarClipMaskSettings]].
 * @see [[DisplayStyleSettingsProps.planarClipOvr]] and [[ContextRealityModelProps.planarClipMask]].
 * @public
 */
export interface PlanarClipMaskProps {
  /** Controls how the mask geometry is collected */
  mode: PlanarClipMaskMode;
  /** @see [[PlanarClipMaskSettings.modelIds]]. */
  modelIds?: CompressedId64Set;
  /** @see [[PlanarClipMaskSettings.subCategoryOrElementIds]]. */
  subCategoryOrElementIds?: CompressedId64Set;
  /** @see [[PlanarClipMaskSettings.priority]]. */
  priority?: number;
  /** @see [[PlanarClipMaskSettings.transparency]]. */
  transparency?: number;
  /** @see PlanarClipMaskSettings.invert */
  invert?: boolean;
}

/** Basic arguments supplied to [[PlanarClipMaskSettings.create]].
 * @public
 */
export interface BasicPlanarClipMaskArgs {
  /** @see [[PlanarClipMaskSettings.transparency]]. */
  transparency?: number;
  /** @see [[PlanarClipMaskSettings.invert]]. */
  invert?: boolean;
}

/** Arguments supplied to [[PlanarClipMaskSettings.create]] to create a mask of [[PlanarClipMaskMode.Models]].
 * @public
 */
export interface ModelPlanarClipMaskArgs extends BasicPlanarClipMaskArgs {
  /** @see [[PlanarClipMaskSettings.modelIds]]. */
  modelIds?: Iterable<Id64String>;
  /** @internal */
  exclude?: never;
  /** @internal */
  elementIds?: never;
  /** @internal */
  subCategoryIds?: never;
  /** @internal */
  priority?: never;
}

/** Arguments supplied to [[PlanarClipMaskSettings.create]] to create a mask of [[PlanarClipMaskMode.IncludeElements]] or [[PlanarClipMaskMode.ExcludeElements]].
 * @public
 */
export interface ElementPlanarClipMaskArgs extends BasicPlanarClipMaskArgs {
  /** @see [[PlanarClipMaskSettings.modelIds]]. */
  modelIds?: Iterable<Id64String>;
  /** The elements used by the mask. @see [[PlanarClipMaskSettings.subCategoryOrElementIds]]. */
  elementIds: Iterable<Id64String>;
  /** If true, creates a mask of [[PlanarClipMaskMode.ExcludeElements]]; otherwise, [[PlanarClipMaskMode.IncludeElements]]. */
  exclude?: boolean;
  /** @internal */
  subCategoryIds?: never;
  /** @internal */
  priority?: never;
}

/** Arguments supplied to [[PlanarClipMaskSettings.create]] to create a mask of [[PlanarClipMaskMode.IncludeSubCategories]].
 * @public
 */
export interface SubCategoryPlanarClipMaskArgs extends BasicPlanarClipMaskArgs {
  /** @see [[PlanarClipMaskSettings.modelIds]]. */
  modelIds?: Iterable<Id64String>;
  /** The subcategories used by the mask. @see [[PlanarClipMaskSettings.subCategoryOrElementIds]]. */
  subCategoryIds: Iterable<Id64String>;
  /** @internal */
  exclude?: never;
  /** @internal */
  elementIds?: never;
  /** @internal */
  priority?: never;
}

/** Arguments supplied to [[PlanarClipMaskSettings.create]] to create a mask of [[PlanarClipMaskMode.Priority]].
 * @public
 */
export interface PriorityPlanarClipMaskArgs extends BasicPlanarClipMaskArgs {
  /** @see [[PlanarClipMaskSettings.priority]]. */
  priority: number;
  /** @internal */
  exclude?: never;
  /** @internal */
  elementIds?: never;
  /** @internal */
  modelIds?: never;
}

/** Describes how to mask the geometry of one [GeometricModel]($backend) for display. The mask is produced by projecting geometry from any number of other models -
 * optionally filtered by [SubCategory]($backend) or by a set of specific [GeometricElement]($backend)s - onto a plane. Regions of the masked model that intersect the
 * mask are rendered partially or completely transparent. This is useful for, e.g., making subsurface geometry visible below the background map, or clipping out portions
 * of a reality model that intersect a design model.
 * @note Currently reality models (including background maps and terrain) can be masked, but design models can only produce masks.
 * @see [[DisplayStyleSettings.planarClipMasks]] to define clip masks for a [DisplayStyle]($backend).
 * @see [[ContextRealityModel.planarClipMaskSettings]] to apply a clip mask to a context reality model.
 * @public
 */
export class PlanarClipMaskSettings {
  /** Specifies how the mask geometry is produced. */
  public readonly mode: PlanarClipMaskMode;
  /** For any mode other than [[PlanarClipMaskMode.Priority]], the Ids of the [GeometricModel]($backend)s containing the geometry used to produce the mask.
   * If `undefined`, the set of all models in the view's [ModelSelector]($backend) is used.
   * The mask geometry can be filtered by [[subCategoryOrElementIds]].
   */
  public readonly modelIds?: OrderedId64Iterable;
  /** For [[PlanarClipMaskMode.IncludeElements]] or [[PlanarClipMaskMode.ExcludedElements]], the Ids of the [GeometricElement]($backend)s to include or exclude from masking;
   * for [[PlanarClipMaskMode.IncludeSubCategories]], the Ids of the subcategories whose geometry contributes to the mask.
   */
  public readonly subCategoryOrElementIds?: OrderedId64Iterable;
  /** For [[PlanarClipMaskMode.Priority]], the priority value. */
  public readonly priority?: number;
  /** A value between 0 and 1 indicating an override for mask transparency. A transparency of 0 indicates complete masking. 1 is completely transparent (no masking).
   If no transparency is defined then the transparencies of the mask elements are used.
   */
  public readonly transparency?: number;
  /** A value of true indicates that the mask should be inverted and only content within the mask should be displayed, in other words the area inside the mask is displayed rather than outside. */
  public readonly invert: boolean;
  private readonly _modelIds?: CompressedId64Set;
  private readonly _subCategoryOrElementIds?: CompressedId64Set;

  /** The compressed representation of [[modelIds]]. */
  public get compressedModelIds(): CompressedId64Set | undefined {
    return this._modelIds;
  }

  /** Create a new [[PlanarClipMaskSettings]] object from its JSON representation. */
  public static fromJSON(json?: PlanarClipMaskProps): PlanarClipMaskSettings {
    if (!json || undefined === json.mode)
      return this.defaults;

    return new PlanarClipMaskSettings(json.mode, json.transparency, json.modelIds, json.subCategoryOrElementIds, json.priority, json.invert);
  }

  /** Create a new PlanarClipMaskSettings. */
  public static create(args: ModelPlanarClipMaskArgs | ElementPlanarClipMaskArgs | SubCategoryPlanarClipMaskArgs | PriorityPlanarClipMaskArgs): PlanarClipMaskSettings {
    const modelIds = args.modelIds ? CompressedId64Set.sortAndCompress(args.modelIds) : undefined;
    if (undefined !== args.priority)
      return new PlanarClipMaskSettings(PlanarClipMaskMode.Priority, args.transparency, undefined, undefined, args.priority, args.invert);
    else if (undefined !== args.subCategoryIds)
      return new PlanarClipMaskSettings(PlanarClipMaskMode.IncludeSubCategories, args.transparency, modelIds, CompressedId64Set.sortAndCompress(args.subCategoryIds), undefined, args.invert);
    else if (undefined !== args.elementIds)
      return new PlanarClipMaskSettings(args.exclude ? PlanarClipMaskMode.ExcludeElements : PlanarClipMaskMode.IncludeElements, args.transparency, modelIds, CompressedId64Set.sortAndCompress(args.elementIds), undefined, args.invert);
    else
      return new PlanarClipMaskSettings(PlanarClipMaskMode.Models, args.transparency, modelIds, undefined, undefined, args.invert);
  }

  /** Create JSON object representing this [[PlanarClipMaskSettings]] */
  public toJSON(): PlanarClipMaskProps {
    const props: PlanarClipMaskProps = { mode: this.mode };
    if (undefined !== this._modelIds)
      props.modelIds = this._modelIds;

    if (undefined !== this._subCategoryOrElementIds)
      props.subCategoryOrElementIds = this._subCategoryOrElementIds;

    if (undefined !== this.priority)
      props.priority = this.priority;

    if (undefined !== this.transparency)
      props.transparency = this.transparency;

    if (this.invert)
      props.invert = true;

    return props;
  }

  /** Returns true if masking is enabled. */
  public get isValid(): boolean {
    return this.mode !== PlanarClipMaskMode.None;
  }

  public equals(other: PlanarClipMaskSettings): boolean {
    return this.mode === other.mode &&
      this.priority === other.priority &&
      this.transparency === other.transparency &&
      this.invert === other.invert &&
      this._modelIds === other._modelIds &&
      this._subCategoryOrElementIds === other._subCategoryOrElementIds;
  }

  /** Create a copy of this TerrainSettings, optionally modifying some of its properties.
   * @param changedProps JSON representation of the properties to change.
   * @returns A PlanarClipMaskSettings with all of its properties set to match those of`this`, except those explicitly defined in `changedProps`.
   */
  public clone(changedProps?: PlanarClipMaskProps): PlanarClipMaskSettings {
    if (undefined === changedProps)
      return this;

    return PlanarClipMaskSettings.fromJSON({
      ...this.toJSON(),
      ...changedProps,
    });
  }

  private constructor(mode: PlanarClipMaskMode, transparency?: number, modelIds?: CompressedId64Set, subCategoryOrElementIds?: CompressedId64Set, priority?: number, invert?: boolean) {
    this.mode = mode;
    this._modelIds = modelIds;
    this._subCategoryOrElementIds = subCategoryOrElementIds;
    this.priority = priority;
    this.invert = true === invert;
    this.transparency = undefined !== transparency ? Math.max(0, Math.min(1, transparency)) : undefined;

    if (modelIds)
      this.modelIds = CompressedId64Set.iterable(modelIds);

    if (subCategoryOrElementIds)
      this.subCategoryOrElementIds = CompressedId64Set.iterable(subCategoryOrElementIds);
  }

  /** A default PlanarClipMask which masks nothing. */
  public static defaults = new PlanarClipMaskSettings(PlanarClipMaskMode.None);
}
