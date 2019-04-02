/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { FeatureOverrideProvider, Viewport } from "./Viewport";
import { ColorDef, ColorDefProps, RgbColor } from "@bentley/imodeljs-common";
import { Id64Set, Id64Arg, Id64 } from "@bentley/bentleyjs-core";
import { FeatureSymbology } from "./rendering";

/** Whether override includes both color and alpha, only color, or only alpha. */
export const enum FeatureOverrideType { ColorOnly, AlphaOnly, ColorAndAlpha }

export interface AppearanceOverrideProps {
  overrideType?: FeatureOverrideType;
  color?: ColorDefProps;
  ids?: Id64Set;
}

export interface EmphasizeElementsProps {
  neverDrawn?: Id64Set;
  alwaysDrawn?: Id64Set;
  isAlwaysDrawnExclusive?: boolean;
  defaultAppearance?: FeatureSymbology.AppearanceProps;
  appearanceOverride?: AppearanceOverrideProps[];
}

/**
 * An implementation of [[FeatureOverrideProvider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 */
export class EmphasizeElements implements FeatureOverrideProvider {
  private _defaultAppearance?: FeatureSymbology.Appearance;
  private _overrideAppearance?: Map<number, Id64Set>;

  /**
   * Establish active feature overrides to emphasize elements and apply color/transparency overrides.
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

  /** @internal */
  protected createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined {
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

  /** Get the current default appearance as established by emphasizeElements. */
  public get defaultAppearance(): FeatureSymbology.Appearance | undefined { return this._defaultAppearance; }

  /** Create default appearance to use for emphasizeElements when not supplied by caller. */
  public createDefaultAppearance(): FeatureSymbology.Appearance {
    return FeatureSymbology.Appearance.fromJSON({
      rgb: new RgbColor(0xe4, 0xe4, 0xe4),
      transparency: 0.8,
      nonLocatable: true,
    });
  }

  /** @internal Get the IDs of the currently never drawn elements. */
  public getNeverDrawnElements(vp: Viewport): Id64Set | undefined { return (undefined !== vp.neverDrawn && 0 !== vp.neverDrawn.size ? vp.neverDrawn : undefined); }
  /** @internal Get the IDs of the currently always drawn elements. */
  public getAlwaysDrawnElements(vp: Viewport): Id64Set | undefined { return (undefined !== vp.alwaysDrawn && 0 !== vp.alwaysDrawn.size ? vp.alwaysDrawn : undefined); }
  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(vp: Viewport): Id64Set | undefined { return this.getNeverDrawnElements(vp); }
  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(vp: Viewport): Id64Set | undefined { return (vp.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements(vp) : undefined); }
  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(vp: Viewport): Id64Set | undefined { return (!vp.isAlwaysDrawnExclusive && undefined !== this._defaultAppearance ? this.getAlwaysDrawnElements(vp) : undefined); }
  /** Get the map of current elements with color/transparency overrides. */
  public getOverriddenElements(): Map<number, Id64Set> | undefined { return (undefined !== this._overrideAppearance && 0 !== this._overrideAppearance.size ? this._overrideAppearance : undefined); }
  /** @internal Get the IDs of current elements with the specified color/tranparency override. */
  public getOverriddenElementsByKey(key: number): Id64Set | undefined { return (undefined !== this._overrideAppearance ? this._overrideAppearance.get(key) : undefined); }

  /** Clear never drawn elements.
   * @return false if nothing to clear.
   * @internal
   */
  public clearNeverDrawnElements(vp: Viewport): boolean {
    if (undefined === this.getNeverDrawnElements(vp))
      return false;
    vp.clearNeverDrawn();
    return true;
  }

  /** Clear always drawn elements.
   * @return false if nothing to clear.
   * @internal
   */
  public clearAlwaysDrawnElements(vp: Viewport): boolean {
    if (undefined === this.getAlwaysDrawnElements(vp))
      return false;
    this._defaultAppearance = undefined;
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
    return this.clearAlwaysDrawnElements(vp);
  }

  /** Clear emphasized elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedElements(vp: Viewport): boolean {
    if (undefined === this.getEmphasizedElements(vp))
      return false;
    return this.clearAlwaysDrawnElements(vp);
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
    vp.view.setFeatureOverridesDirty(true);
    return true;
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
    const hiddenIds = new Set<string>();
    Id64.toIdSet(ids).forEach((id) => { hiddenIds.add(id); });
    if (0 === hiddenIds.size)
      return false;
    const oldSize = (!replace && undefined !== vp.neverDrawn ? vp.neverDrawn.size : 0);
    if (0 !== oldSize && undefined !== vp.neverDrawn)
      for (const id of vp.neverDrawn)
        hiddenIds.add(id);
    if (oldSize === hiddenIds.size)
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
    const visibleIds = new Set<string>();
    Id64.toIdSet(ids).forEach((id) => { visibleIds.add(id); });
    if (0 === visibleIds.size)
      return false;
    const oldSize = (!replace && undefined !== vp.alwaysDrawn ? vp.alwaysDrawn.size : 0);
    if (0 !== oldSize && undefined !== vp.alwaysDrawn)
      for (const id of vp.alwaysDrawn)
        visibleIds.add(id);
    if (oldSize === visibleIds.size)
      return false;
    this._defaultAppearance = undefined;
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
    return this.setAlwaysDrawnElements(ids, vp, true, replace);
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
    if (!this.setAlwaysDrawnElements(ids, vp, false, replace))
      return false;
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
    vp.view.setFeatureOverridesDirty(true);
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
    else if (undefined !== this.defaultAppearance)
      props.defaultAppearance = this.defaultAppearance; // emphasize
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
    if (undefined !== props.neverDrawn) {
      if (this.setNeverDrawnElements(props.neverDrawn, vp, true))
        changed = true;
    }
    if (undefined !== props.alwaysDrawn) {
      if (undefined !== props.defaultAppearance) {
        if (this.emphasizeElements(props.alwaysDrawn, vp, FeatureSymbology.Appearance.fromJSON(props.defaultAppearance), true))
          changed = true;
      } else {
        if (this.setAlwaysDrawnElements(props.alwaysDrawn, vp, props.isAlwaysDrawnExclusive))
          changed = true;
      }
    }
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

  // ###TODO - Implement toJSON/fromJSON...
}
