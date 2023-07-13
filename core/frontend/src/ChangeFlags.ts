/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

/** Bit masks describing which aspects of a [[Viewport]] have changed as part of a [[ChangeFlags]].
 * @see [[Viewport.onViewportChanged]].
 * @public
 */
export enum ChangeFlag {
  /** No changes. */
  None = 0,
  /** See [[ChangeFlags.alwaysDrawn]]. */
  AlwaysDrawn = 1 << 0,
  /** See [[ChangeFlags.neverDrawn]]. */
  NeverDrawn = 1 << 1,
  /** See [[ChangeFlags.viewedCategories]]. */
  ViewedCategories = 1 << 2,
  /** See [[ChangeFlags.viewedModels]]. */
  ViewedModels = 1 << 3,
  /** See [[ChangeFlags.displayStyle]]. */
  DisplayStyle = 1 << 4,
  /** See [[ChangeFlags.featureOverrideProvider]]. */
  FeatureOverrideProvider = 1 << 5,
  /** See [[ChangeFlags.viewedCategoriesPerModel]]. */
  ViewedCategoriesPerModel = 1 << 6,
  /** See [[ChangeFlags.viewState]]. */
  ViewState = 1 << 7, // eslint-disable-line no-shadow
  /** A bitmask indicating all aspects of the viewport's state have changed. */
  All = 0x0fffffff,
  /** A bitmask indicating all aspects of the viewport's state related to symbology overrides have changed. */
  Overrides = ChangeFlag.All & ~(ChangeFlag.ViewedModels | ChangeFlag.ViewState),
  /** A bitmask indicating the initial state of a newly-created [[Viewport]]. */
  Initial = ChangeFlag.ViewedCategories | ChangeFlag.ViewedModels | ChangeFlag.DisplayStyle,
}

/** Describes which aspects of a [[Viewport]] have changed. Each time [[Viewport.renderFrame]] is invoked, the aspects of the viewport that have changed since
 * the previous call to `renderFrame` are computed and dispatched via the [[Viewport.onViewportChanged]] event.
 * @public
 * @extensions
 */
export class ChangeFlags {
  /** The bitmask that records the state of each individual flag. */
  protected _flags: ChangeFlag;

  /** Create a new ChangeFlags.
   * @param flags The initial flags that should be set.
   */
  public constructor(flags = ChangeFlag.Initial) {
    this._flags = flags;
  }

  /** The set of always-drawn elements has changed.
   * @see [[Viewport.setAlwaysDrawn]] and [[Viewport.clearAlwaysDrawn]].
   */
  public get alwaysDrawn() { return this.isSet(ChangeFlag.AlwaysDrawn); }

  /** The set of never-drawn elements has changed.
   * @see [[Viewport.setNeverDrawn]] and [[Viewport.clearNeverDrawn]].
   */
  public get neverDrawn() { return this.isSet(ChangeFlag.NeverDrawn); }

  /** The set of displayed categories defined by the viewport's [[CategorySelectorState]] has changed. */
  public get viewedCategories() { return this.isSet(ChangeFlag.ViewedCategories); }

  /** The set of models to be displayed in the viewport has changed. */
  public get viewedModels() { return this.isSet(ChangeFlag.ViewedModels); }

  /** The [[DisplayStyleState]] or its settings such as [ViewFlags]($common) have changed. */
  public get displayStyle() { return this.isSet(ChangeFlag.DisplayStyle); }

  /** The [[FeatureOverrideProvider]] has changed, or its internal state has changed such that its overrides must be recomputed.
   * @see [[Viewport.addFeatureOverrideProvider]] and [[Viewport.setFeatureOverrideProviderChanged]].
   */
  public get featureOverrideProvider() { return this.isSet(ChangeFlag.FeatureOverrideProvider); }

  /** [[Vewport.changeView]] was used to replace the previous [[ViewState]] with a new one. */
  public get viewState() { return this.isSet(ChangeFlag.ViewState); }

  /** The [[PerModelCategoryVisibility.Overrides]] associated with the viewport have changed.
   * @beta
   */
  public get viewedCategoriesPerModel() { return this.isSet(ChangeFlag.ViewedCategoriesPerModel); }

  /** Returns true if any of the specified flags are set. */
  public isSet(flags: ChangeFlag): boolean { return 0 !== (this._flags & flags); }

  /** Returns true if all of the specified flags are set. */
  public areAllSet(flags: ChangeFlag): boolean { return flags === (this._flags & flags); }

  /** Returns true if any aspects affecting [[FeatureSymbology.Overrides]] have changed. */
  public get areFeatureOverridesDirty() { return this.isSet(ChangeFlag.Overrides); }

  /** Returns true if any aspect at all has changed. */
  public get hasChanges() { return this.isSet(ChangeFlag.All); }

  /** The underlying bitmask indicating the state of each individual flag. */
  public get value(): ChangeFlag { return this._flags; }
}

/** A [[ChangeFlags]] that permits modifying the states of individual [[ChangeFlag]]s.
 * @public
 */
export class MutableChangeFlags extends ChangeFlags {
  /** Create a new MutableChangeFlags.
   * @param flags The initial flags that should be set.
   */
  public constructor(flags = ChangeFlag.Initial) {
    super(flags);
  }

  /** Set all of the specified flags. */
  private set(flags: ChangeFlag): void { this._flags |= flags; }

  public setAlwaysDrawn() { this.set(ChangeFlag.AlwaysDrawn); }
  public setNeverDrawn() { this.set(ChangeFlag.NeverDrawn); }
  public setViewedCategories() { this.set(ChangeFlag.ViewedCategories); }
  public setViewedModels() { this.set(ChangeFlag.ViewedModels); }
  public setDisplayStyle() { this.set(ChangeFlag.DisplayStyle); }
  public setFeatureOverrideProvider() { this.set(ChangeFlag.FeatureOverrideProvider); }
  public setViewState() { this.set(ChangeFlag.ViewState); }
  public setViewedCategoriesPerModel() { this.set(ChangeFlag.ViewedCategoriesPerModel); }

  /** Clear all of the specified flags. By default, clears all flags. */
  public clear(flags: ChangeFlag = ChangeFlag.All): void { this._flags &= ~flags; }
}
