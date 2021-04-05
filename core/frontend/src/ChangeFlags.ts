/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

/** Bit masks describing which aspects of a [[Viewport]] have changed as part of a [[ChangeFlags]].
 * @see [[Viewport.onViewportChanged]].
 * @internal
 */
export enum ChangeFlag {
  None = 0,
  AlwaysDrawn = 1 << 0,
  NeverDrawn = 1 << 1,
  ViewedCategories = 1 << 2,
  ViewedModels = 1 << 3,
  DisplayStyle = 1 << 4,
  FeatureOverrideProvider = 1 << 5,
  ViewedCategoriesPerModel = 1 << 6,
  ViewState = 1 << 7, // eslint-disable-line no-shadow
  All = 0x0fffffff,
  Overrides = ChangeFlag.All & ~(ChangeFlag.ViewedModels | ChangeFlag.ViewState),
  Initial = ChangeFlag.ViewedCategories | ChangeFlag.ViewedModels | ChangeFlag.DisplayStyle,
}

/** Describes which aspects of a [[Viewport]] have changed. Each time [[Viewport.renderFrame]] is invoked, the aspects of the viewport that have changed since
 * the previous call to `renderFrame` are computed and dispatched via the [[Viewport.onViewportChanged]] event.
 * @public
 */
export class ChangeFlags {
  /** @internal */
  protected _flags: ChangeFlag;

  /** @internal */
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

  /** Return true if any of the specified flags are set.
   * @internal
   */
  public isSet(flags: ChangeFlag): boolean { return 0 !== (this._flags & flags); }

  /** Return true if all of the specified flags are set.
   * @internal
   */
  public areAllSet(flags: ChangeFlag): boolean { return flags === (this._flags & flags); }

  /** Returns true if any aspects affecting [[FeatureSymbology.Overrides]] have changed. */
  public get areFeatureOverridesDirty() { return this.isSet(ChangeFlag.Overrides); }

  /** Returns true if any aspect at all has changed. */
  public get hasChanges() { return this.isSet(ChangeFlag.All); }

  /** @internal */
  public get value(): ChangeFlag { return this._flags; }
}

/** Mutable [[ChangelFlags]].
 * @internal Used internally by Viewport.
 */
export class MutableChangeFlags extends ChangeFlags {
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
