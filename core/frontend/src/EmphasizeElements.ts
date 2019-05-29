/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { FeatureOverrideProvider, Viewport } from "./Viewport";
import { ColorDef, ColorDefProps, RgbColor } from "@bentley/imodeljs-common";
import { Id64Set, Id64Arg, Id64 } from "@bentley/bentleyjs-core";
import { FeatureSymbology } from "./rendering";

/** Whether override includes both color and alpha, only color, or only alpha.
 * @internal
 */
export enum FeatureOverrideType { ColorOnly, AlphaOnly, ColorAndAlpha }

/** @internal */
export interface AppearanceOverrideProps {
  overrideType?: FeatureOverrideType;
  color?: ColorDefProps;
  ids?: Id64Set;
}

/** @internal */
export interface EmphasizeElementsProps {
  neverDrawn?: Id64Set;
  alwaysDrawn?: Id64Set;
  isAlwaysDrawnExclusive?: boolean;
  alwaysDrawnExclusiveEmphasized?: Id64Set;
  defaultAppearance?: FeatureSymbology.AppearanceProps;
  appearanceOverride?: AppearanceOverrideProps[];
}

/** An implementation of [[FeatureOverrideProvider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 * @internal
 */
export class EmphasizeElements implements FeatureOverrideProvider {
  private _defaultAppearance?: FeatureSymbology.Appearance;
  private _emphasizeIsolated?: Id64Set;
  private _overrideAppearance?: Map<number, Id64Set>;

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides.
   * @see [[Viewport.featureOverrideProvider]]
   */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, vp: Viewport): void {
    const emphasizedElements = this.getEmphasizedElements(vp);
    if (undefined !== emphasizedElements) {
      overrides.setDefaultOverrides(this._defaultAppearance!);
      const app = FeatureSymbology.Appearance.defaults;
      emphasizedElements.forEach((id) => { overrides.overrideElement(id, app); });
    }
    const overriddenElements = this.getOverriddenElements();
    if (undefined !== overriddenElements) {
      if (undefined !== this._defaultAppearance)
        overrides.setDefaultOverrides(this._defaultAppearance);
      for (const [key, ids] of overriddenElements) {
        const ovrApp = this.createAppearanceFromKey(key);
        ids.forEach((id) => { overrides.overrideElement(id, ovrApp); });
      }
    }
  }

  /** @internal */
  protected createAppearanceFromKey(key: number): FeatureSymbology.Appearance {
    if (key < 0)
      return FeatureSymbology.Appearance.fromTransparency(Math.abs(key));
    const color = ColorDef.fromJSON(key);
    if (0 === color.getAlpha())
      return FeatureSymbology.Appearance.fromRgb(color); // Fully transparent signifies to use color only...
    return FeatureSymbology.Appearance.fromRgba(color);
  }

  /** Get override key from color and override type */
  public createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined {
    const colorValues = color.colors;
    switch (override) {
      case FeatureOverrideType.ColorAndAlpha:
        return 255 === colorValues.t ? undefined : color.tbgr; // Hiding elements should be done using neverDrawn, not transparency...
      case FeatureOverrideType.ColorOnly:
        return ColorDef.from(colorValues.r, colorValues.g, colorValues.b, 255).tbgr;
      case FeatureOverrideType.AlphaOnly:
        return -(colorValues.t / 255);
    }
  }

  /** Get color and override type for the given key. */
  public getOverrideFromKey(key: number, color: ColorDef): FeatureOverrideType {
    if (key < 0) {
      color.setFrom(ColorDef.from(0, 0, 0, 255 * Math.abs(key)));
      return FeatureOverrideType.AlphaOnly;
    }
    color.setFrom(ColorDef.fromJSON(key));
    if (0 === color.getAlpha()) {
      color.setAlpha(255);
      return FeatureOverrideType.ColorOnly;
    }
    return FeatureOverrideType.ColorAndAlpha;
  }

  /** Get the current default appearance such as used by emphasizeElements. */
  public get defaultAppearance(): FeatureSymbology.Appearance | undefined { return this._defaultAppearance; }

  /** Set the current default appearance for use with overrideElements when not using emphasizeElements. */
  public set defaultAppearance(appearance: FeatureSymbology.Appearance | undefined) { this._defaultAppearance = appearance; }

  /** Create default appearance to use for emphasizeElements when not supplied by caller. */
  public createDefaultAppearance(): FeatureSymbology.Appearance {
    return FeatureSymbology.Appearance.fromJSON({
      rgb: new RgbColor(0xe4, 0xe4, 0xe4),
      transparency: 0.8,
      nonLocatable: true,
    });
  }

  /** Get the IDs of the currently never drawn elements. */
  public getNeverDrawnElements(vp: Viewport): Id64Set | undefined { return (undefined !== vp.neverDrawn && 0 !== vp.neverDrawn.size ? vp.neverDrawn : undefined); }
  /** Get the IDs of the currently always drawn elements. */
  public getAlwaysDrawnElements(vp: Viewport): Id64Set | undefined { return (undefined !== vp.alwaysDrawn && 0 !== vp.alwaysDrawn.size ? vp.alwaysDrawn : undefined); }
  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(vp: Viewport): Id64Set | undefined { return this.getNeverDrawnElements(vp); }
  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(vp: Viewport): Id64Set | undefined { return (vp.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements(vp) : undefined); }
  /** Get the IDs of the currently emphasized isolated elements. */
  public getEmphasizedIsolatedElements(): Id64Set | undefined { return (undefined !== this._defaultAppearance && undefined !== this._emphasizeIsolated && 0 !== this._emphasizeIsolated.size ? this._emphasizeIsolated : undefined); }
  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(vp: Viewport): Id64Set | undefined { return (undefined !== this.getEmphasizedIsolatedElements() ? this._emphasizeIsolated : (undefined !== this._defaultAppearance && !vp.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements(vp) : undefined)); }
  /** Get the map of current elements with color/transparency overrides. */
  public getOverriddenElements(): Map<number, Id64Set> | undefined { return (undefined !== this._overrideAppearance && 0 !== this._overrideAppearance.size ? this._overrideAppearance : undefined); }
  /** Get the IDs of current elements with the specified color/transparency override. */
  public getOverriddenElementsByKey(key: number): Id64Set | undefined { return (undefined !== this._overrideAppearance ? this._overrideAppearance.get(key) : undefined); }

  /** Clear never drawn elements.
   * @return false if nothing to clear.
   */
  public clearNeverDrawnElements(vp: Viewport): boolean {
    if (undefined === this.getNeverDrawnElements(vp))
      return false;
    vp.clearNeverDrawn();
    return true;
  }

  /** Clear always drawn elements.
   * @return false if nothing to clear.
   */
  public clearAlwaysDrawnElements(vp: Viewport): boolean {
    if (undefined === this.getAlwaysDrawnElements(vp))
      return false;
    vp.clearAlwaysDrawn();
    return true;
  }

  /** Clear hidden elements.
   * @return false if nothing to clear.
   */
  public clearHiddenElements(vp: Viewport): boolean {
    return this.clearNeverDrawnElements(vp);
  }

  /** Clear isolated elements.
   * @return false if nothing to clear.
   */
  public clearIsolatedElements(vp: Viewport): boolean {
    if (undefined === this.getIsolatedElements(vp))
      return false;
    if (this.clearEmphasizedIsolatedElements(vp, true))
      return true;
    return this.clearAlwaysDrawnElements(vp);
  }

  /** Clear emphasized elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedElements(vp: Viewport): boolean {
    if (undefined === this.getEmphasizedElements(vp))
      return false;
    if (this.clearEmphasizedIsolatedElements(vp, false))
      return true;
    if (!this.clearAlwaysDrawnElements(vp))
      return false;
    this._defaultAppearance = undefined;
    return true;
  }

  /** Clear emphasized isolated elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedIsolatedElements(vp: Viewport, setToAlwaysDrawn: boolean): boolean {
    const emphasizedIsolated = this.getEmphasizedIsolatedElements();
    this._emphasizeIsolated = undefined; // Always clear in case default appearance was unset...
    if (undefined === emphasizedIsolated)
      return false;
    if (setToAlwaysDrawn && this.setAlwaysDrawnElements(emphasizedIsolated, vp, false))
      return true;
    this._defaultAppearance = undefined;
    vp.setFeatureOverrideProviderChanged();
    return true;
  }

  /** Clear elements with color/transparency overrides. Specify key to clear only a single override.
   * @return false if nothing to clear.
   */
  public clearOverriddenElements(vp: Viewport, key?: number): boolean {
    if (undefined === this._overrideAppearance)
      return false;
    if (undefined !== key) {
      if (!this._overrideAppearance.delete(key))
        return false;
    } else {
      this._overrideAppearance = undefined;
    }
    vp.setFeatureOverrideProviderChanged();
    return true;
  }

  /** @internal */
  protected updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined {
    const newIds = new Set<string>();
    Id64.toIdSet(ids).forEach((id) => { newIds.add(id); });
    if (0 === newIds.size)
      return undefined;
    const oldSize = (!replace && undefined !== existingIds ? existingIds.size : 0);
    if (0 !== oldSize && undefined !== existingIds)
      for (const id of existingIds)
        newIds.add(id);
    if (oldSize === newIds.size)
      return undefined;
    return newIds;
  }

  /** Set the element IDs to be never drawn.
   * @param ids The IDs of the elements to never draw.
   * @param vp The viewport.
   * @param replace true to replace currently hidden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.neverDrawn]]
   * @internal
   */
  public setNeverDrawnElements(ids: Id64Arg, vp: Viewport, replace: boolean = true): boolean {
    const hiddenIds = this.updateIdSet(ids, replace, vp.neverDrawn);
    if (undefined === hiddenIds)
      return false;
    vp.setNeverDrawn(hiddenIds);
    return true;
  }

  /** Set the element IDs to be always drawn.
   * @param ids The IDs of the elements to always draw.
   * @param vp The viewport.
   * @param exclusive If true, *only* the specified elements will be drawn.
   * @param replace true to replace currently always drawn elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.isAlwaysDrawnExclusive]]
   * @internal
   */
  public setAlwaysDrawnElements(ids: Id64Arg, vp: Viewport, exclusive: boolean = true, replace: boolean = true): boolean {
    const visibleIds = this.updateIdSet(ids, replace, vp.alwaysDrawn);
    if (undefined === visibleIds)
      return false;
    vp.setAlwaysDrawn(visibleIds, exclusive);
    return true;
  }

  /** Set the element IDs to be never drawn.
   * @param ids The IDs of the elements to never draw.
   * @param vp The viewport.
   * @param replace true to replace currently hidden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.neverDrawn]]
   */
  public hideElements(ids: Id64Arg, vp: Viewport, replace: boolean = false): boolean {
    return this.setNeverDrawnElements(ids, vp, replace);
  }

  /** Set the currently selected elements to be never drawn.
   * @param vp The viewport.
   * @param replace true to replace currently hidden elements (if any) or false to add to the existing set.
   * @param clearSelection true to clear current selection after setting appearance override, false to leave selected.
   * @return true if overrides were changed.
   * @see [[Viewport.neverDrawn]]
   */
  public hideSelectedElements(vp: Viewport, replace: boolean = false, clearSelection: boolean = true): boolean {
    const selection = vp.view.iModel.selectionSet;
    if (!selection.isActive || !this.hideElements(selection.elements, vp, replace))
      return false;
    if (clearSelection)
      selection.emptyAll();
    return true;
  }

  /** Set the element IDs to be always drawn exclusively.
   * @param ids The IDs of the elements to always draw.
   * @param vp The viewport.
   * @param replace true to replace currently isolated elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.isAlwaysDrawnExclusive]]
   */
  public isolateElements(ids: Id64Arg, vp: Viewport, replace: boolean = true): boolean {
    const wasEmphasized = (undefined !== this.getEmphasizedElements(vp));
    if (!this.setAlwaysDrawnElements(ids, vp, true, replace))
      return false;
    if (wasEmphasized)
      this._defaultAppearance = this._emphasizeIsolated = undefined; // Don't clear defaultAppearance unless it was established by emphasize...
    return true;
  }

  /** Set the currently selected elements to be always drawn exclusively.
   * @param vp The viewport.
   * @param replace true to replace currently isolated elements (if any) or false to add to the existing set.
   * @param clearSelection true to clear current selection after setting appearance override, false to leave selected.
   * @return true if overrides were changed.
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.isAlwaysDrawnExclusive]]
   */
  public isolateSelectedElements(vp: Viewport, replace: boolean = true, clearSelection: boolean = true): boolean {
    const selection = vp.view.iModel.selectionSet;
    if (!selection.isActive || !this.isolateElements(selection.elements, vp, replace))
      return false;
    if (clearSelection)
      selection.emptyAll();
    return true;
  }

  /** Set the element IDs to be always drawn normally with all other elements in the view overridden to draw using a default appearance..
   * @param ids The IDs of the elements to always draw.
   * @param vp The viewport.
   * @param defaultAppearance Optional default appearance, uses non-locatable transparent grey if not specified.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.isAlwaysDrawnExclusive]]
   */
  public emphasizeElements(ids: Id64Arg, vp: Viewport, defaultAppearance?: FeatureSymbology.Appearance, replace: boolean = true): boolean {
    if (undefined !== this.getIsolatedElements(vp)) {
      const emphasizeIds = this.updateIdSet(ids, replace, this._emphasizeIsolated);
      if (undefined === emphasizeIds)
        return false;
      this._emphasizeIsolated = emphasizeIds;
      vp.setFeatureOverrideProviderChanged();
    } else {
      if (!this.setAlwaysDrawnElements(ids, vp, false, replace))
        return false;
      this._emphasizeIsolated = undefined;
    }
    this._defaultAppearance = (undefined === defaultAppearance ? this.createDefaultAppearance() : defaultAppearance);
    return true;
  }

  /** Set the currently selected elements to be always drawn normally with all other elements in the view overridden to draw using a default appearance.
   * @param vp The viewport.
   * @param defaultAppearance Optional default appearance, uses transparent grey if not specified.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @param clearSelection true to clear current selection after setting appearance override, false to leave selected.
   * @return true if overrides were changed.
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.isAlwaysDrawnExclusive]]
   */
  public emphasizeSelectedElements(vp: Viewport, defaultAppearance?: FeatureSymbology.Appearance, replace: boolean = true, clearSelection: boolean = true): boolean {
    const selection = vp.view.iModel.selectionSet;
    if (!selection.isActive || !this.emphasizeElements(selection.elements, vp, defaultAppearance, replace))
      return false;

    if (clearSelection)
      selection.emptyAll();

    return true;
  }

  /** Set the element IDs to display with a color/transparency override.
   * @param ids The IDs of the elements.
   * @param vp The viewport.
   * @param color ColorDef to specify override rgb and alpha.
   * @param override Whether to use color and alpha, only color, or only alpha from the supplied ColorDef.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.featureOverrideProvider]]
   */
  public overrideElements(ids: Id64Arg, vp: Viewport, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
    const ovrKey = this.createOverrideKey(color, override);
    if (undefined === ovrKey)
      return false;

    const overrideIds = new Set<string>();
    Id64.toIdSet(ids).forEach((id) => { overrideIds.add(id); });
    if (0 === overrideIds.size)
      return false;

    const existingIds = (!replace ? this.getOverriddenElementsByKey(ovrKey) : undefined);
    const oldSize = (undefined !== existingIds ? existingIds.size : 0);
    if (0 !== oldSize && undefined !== existingIds)
      for (const id of existingIds)
        overrideIds.add(id);

    if (oldSize === overrideIds.size)
      return false;

    if (undefined === this._overrideAppearance) {
      this._overrideAppearance = new Map<number, Id64Set>();
    } else {
      for (const [key, otherIds] of this._overrideAppearance) {
        if (key === ovrKey) // Make sure these ids are unique to this color/transparency key...
          continue;

        Id64.toIdSet(ids).forEach((id) => { otherIds.delete(id); });
        if (0 !== otherIds.size)
          continue;

        this._overrideAppearance.delete(key);
      }
    }

    this._overrideAppearance.set(ovrKey, overrideIds);
    vp.setFeatureOverrideProviderChanged();

    return true;
  }

  /** Set the currently selected elements to display with a color/transparency override.
   * @param vp The viewport.
   * @param color ColorDef to specify override rgb and alpha.
   * @param override Whether to use color and alpha, only color, or only alpha from the supplied ColorDef.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @param clearSelection true to clear current selection after setting appearance override, false to leave selected.
   * @return true if overrides were changed.
   * @see [[Viewport.featureOverrideProvider]]
   */
  public overrideSelectedElements(vp: Viewport, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false, clearSelection: boolean = true): boolean {
    const selection = vp.view.iModel.selectionSet;
    if (!selection.isActive || !this.overrideElements(selection.elements, vp, color, override, replace))
      return false;
    if (clearSelection)
      selection.emptyAll();
    return true;
  }

  /** @return true if provider is currently overriding the display of any elements. */
  public isActive(vp: Viewport): boolean { return (undefined !== this.getNeverDrawnElements(vp) || undefined !== this.getAlwaysDrawnElements(vp) || undefined !== this.getOverriddenElements()); }

  public toJSON(vp: Viewport): EmphasizeElementsProps {
    const props: EmphasizeElementsProps = {};
    const neverDrawn = this.getNeverDrawnElements(vp);
    if (undefined !== neverDrawn)
      props.neverDrawn = new Set(neverDrawn);
    const alwaysDrawn = this.getAlwaysDrawnElements(vp);
    if (undefined !== alwaysDrawn)
      props.alwaysDrawn = new Set(alwaysDrawn);
    if (vp.isAlwaysDrawnExclusive)
      props.isAlwaysDrawnExclusive = true; // isolate
    const alwaysDrawnExclusiveEmphasized = this.getEmphasizedIsolatedElements();
    if (undefined !== alwaysDrawnExclusiveEmphasized)
      props.alwaysDrawnExclusiveEmphasized = new Set(alwaysDrawnExclusiveEmphasized);
    if (undefined !== this.defaultAppearance)
      props.defaultAppearance = this.defaultAppearance; // emphasize (or specifically set for override)
    const overriddenElements = this.getOverriddenElements();
    if (undefined !== overriddenElements) {
      const appearanceOverride: AppearanceOverrideProps[] = [];
      const color = new ColorDef();
      for (const [key, ovrIds] of overriddenElements) {
        const overrideType = this.getOverrideFromKey(key, color);
        const ids = new Set(ovrIds);
        appearanceOverride.push({ overrideType, color, ids });
      }
      props.appearanceOverride = appearanceOverride;
    }
    return props;
  }

  public fromJSON(props: EmphasizeElementsProps, vp: Viewport): boolean {
    let changed = false;
    if (undefined !== props.neverDrawn && this.setNeverDrawnElements(props.neverDrawn, vp, true))
      changed = true;
    if (undefined !== props.alwaysDrawn && this.setAlwaysDrawnElements(props.alwaysDrawn, vp, undefined !== props.isAlwaysDrawnExclusive && props.isAlwaysDrawnExclusive))
      changed = true;
    if (undefined !== props.alwaysDrawnExclusiveEmphasized)
      this._emphasizeIsolated = props.alwaysDrawnExclusiveEmphasized; // changed status determined by setAlwaysDrawnElements...
    if (undefined !== props.defaultAppearance)
      this.defaultAppearance = FeatureSymbology.Appearance.fromJSON(props.defaultAppearance); // changed status determined by setAlwaysDrawnElements or overrideElements...
    if (undefined !== props.appearanceOverride) {
      for (const ovrApp of props.appearanceOverride) {
        if (undefined === ovrApp.ids)
          continue;
        if (this.overrideElements(ovrApp.ids, vp, ColorDef.fromJSON(ovrApp.color), ovrApp.overrideType, true))
          changed = true;
      }
    }
    return changed;
  }

  /** Get current [[Viewport.featureOverrideProvider]] if it's an instance of EmphasizeElements. */
  public static get(vp: Viewport): EmphasizeElements | undefined {
    return (vp.featureOverrideProvider instanceof EmphasizeElements ? vp.featureOverrideProvider : undefined);
  }

  /** Get or replace current [[Viewport.featureOverrideProvider]] with an instance of EmphasizeElements. */
  public static getOrCreate(vp: Viewport): EmphasizeElements {
    let provider = vp.featureOverrideProvider instanceof EmphasizeElements ? vp.featureOverrideProvider : undefined;
    if (undefined === provider) {
      provider = new EmphasizeElements();
      vp.featureOverrideProvider = provider;
    }
    return provider;
  }

  /** Clear current [[Viewport.featureOverrideProvider]] if it's an instance of EmphasizeElements. */
  public static clear(vp: Viewport, inactiveOnly: boolean = false) {
    const provider = vp.featureOverrideProvider instanceof EmphasizeElements ? vp.featureOverrideProvider : undefined;
    if (undefined === provider || (inactiveOnly && provider.isActive))
      return;
    vp.clearNeverDrawn();
    vp.clearAlwaysDrawn();
    vp.featureOverrideProvider = undefined;
  }
}
