/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

/** @see [[ChangeFlags]]
 * @beta
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

/** Viewport event synchronization flags. Used primarily for tracking changes that affect the viewport's [[FeatureSymbology.Overrides]].
 * Each time [[Viewport.renderFrame]] is invoked, the effects of any changes to these flags will be applied, and corresponding events dispatched.
 * An individual flag is true if the corresponding Viewport state has changed and needs to be synchronized.
 * @beta
 */
export class ChangeFlags {
  private _flags: ChangeFlag;

  /** The set of always drawn elements has changed. */
  public get alwaysDrawn() { return this.isSet(ChangeFlag.AlwaysDrawn); }
  public setAlwaysDrawn() { this.set(ChangeFlag.AlwaysDrawn); }
  /** The set of never drawn elements has changed. */
  public get neverDrawn() { return this.isSet(ChangeFlag.NeverDrawn); }
  public setNeverDrawn() { this.set(ChangeFlag.NeverDrawn); }
  /** The set of displayed categories has changed. */
  public get viewedCategories() { return this.isSet(ChangeFlag.ViewedCategories); }
  public setViewedCategories() { this.set(ChangeFlag.ViewedCategories); }
  /** The set of displayed models has changed. */
  public get viewedModels() { return this.isSet(ChangeFlag.ViewedModels); }
  public setViewedModels() { this.set(ChangeFlag.ViewedModels); }
  /** The display style or its settings such as [ViewFlags]($common) have changed. */
  public get displayStyle() { return this.isSet(ChangeFlag.DisplayStyle); }
  public setDisplayStyle() { this.set(ChangeFlag.DisplayStyle); }
  /** The [[FeatureOverrideProvider]] has changed, or its internal state has changed such that its overrides must be recomputed. */
  public get featureOverrideProvider() { return this.isSet(ChangeFlag.FeatureOverrideProvider); }
  public setFeatureOverrideProvider() { this.set(ChangeFlag.FeatureOverrideProvider); }
  /** [[changeView]] was used to replace the previous [[ViewState]] with a new one. */
  public get viewState() { return this.isSet(ChangeFlag.ViewState); }
  public setViewState() { this.set(ChangeFlag.ViewState); }
  /** The [[PerModelCategoryVisibility.Overrides]] associated with the viewport have changed. */
  public get viewedCategoriesPerModel() { return this.isSet(ChangeFlag.ViewedCategoriesPerModel); }
  public setViewedCategoriesPerModel() { this.set(ChangeFlag.ViewedCategoriesPerModel); }

  public constructor(flags = ChangeFlag.Initial) { this._flags = flags; }

  /** Return true if any of the specified flags are set. */
  public isSet(flags: ChangeFlag): boolean { return 0 !== (this._flags & flags); }
  /** Return true if all of the specified flags are set. */
  public areAllSet(flags: ChangeFlag): boolean { return flags === (this._flags & flags); }
  /** Set all of the specified flags. */
  public set(flags: ChangeFlag): void { this._flags |= flags; }
  /** Clear all of the specified flags. By default, clears all flags. */
  public clear(flags: ChangeFlag = ChangeFlag.All): void { this._flags &= ~flags; }
  /** Returns true if any flag affecting FeatureSymbology.Overrides is set. */
  public get areFeatureOverridesDirty() { return this.isSet(ChangeFlag.Overrides); }
  /** Returns true if any flag is set. */
  public get hasChanges() { return this.isSet(ChangeFlag.All); }

  public get value(): ChangeFlag { return this._flags; }
}
