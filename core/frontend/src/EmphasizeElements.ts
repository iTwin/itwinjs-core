/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64, Id64Arg, Id64Set } from "@itwin/core-bentley";
import { AppearanceOverrideProps, ColorDef, EmphasizeElementsProps, FeatureAppearance, FeatureOverrideType, RgbColor } from "@itwin/core-common";
import { IModelDisplayReference } from "./IModelDisplayReference";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { FeatureOverrideProvider, FeatureSymbologyOverrider } from "./FeatureOverrideProvider";
import { Viewport } from "./Viewport";

interface EmphasizeElementsState {
  defaultAppearance?: FeatureAppearance;
  unanimatedAppearance?: FeatureAppearance;
  emphasizeIsolated?: Id64Set;
  overrideAppearance?: Map<number, Id64Set>;
  wantEmphasis: boolean;
  emphasizedAppearance: FeatureAppearance;
}

function addFeatureOverrides(overrides: FeatureSymbology.Overrides, ref: IModelDisplayReference, state: EmphasizeElementsState): void {
  if (undefined !== state.defaultAppearance)
    overrides.setDefaultOverrides(state.defaultAppearance);

  const emphasizedElements = getEmphasizedElements(ref, state);
  if (undefined !== emphasizedElements) {
    const appearance = state.wantEmphasis ? state.emphasizedAppearance : FeatureAppearance.defaults;

    const args = { elementId: "", appearance };
    for (const elementId of emphasizedElements) {
      args.elementId = elementId;
      overrides.override(args);
    }

    overrides.ignoreAnimationOverrides((args) => {
      const id = Id64.fromUint32Pair(args.elementId.lower, args.elementId.upper);
      return !emphasizedElements.has(id);
    });
  }

  const overriddenElements = getOverriddenElements(state);
  if (undefined !== overriddenElements) {
    const args = { elementId: "", appearance: FeatureAppearance.defaults };
    for (const [key, ids] of overriddenElements) {
      args.appearance = createAppearanceFromKey(key, state);
      for (const elementId of ids) {
        args.elementId = elementId;
        overrides.override(args);
      }
    }
  }

  if (state.unanimatedAppearance) {
    if (state.unanimatedAppearance.isFullyTransparent)
      overrides.neverDrawnAnimationNodes.add(0);
    else
      overrides.animationNodeOverrides.set(0, state.unanimatedAppearance);
  }
}

function createAppearanceFromKey(key: number, state: EmphasizeElementsState): FeatureAppearance {
  let transparency: number | undefined;
  let rgb: RgbColor | undefined;

  if (key < 0) {
    transparency = Math.abs(key);
  } else {
    const color = ColorDef.fromJSON(key);
    rgb = RgbColor.fromColorDef(color);
    if (0 !== color.getAlpha())
      transparency = color.getTransparency() / 255;
  }

  const emphasized = state.wantEmphasis ? true : undefined;
  return FeatureAppearance.fromJSON({ rgb, transparency, emphasized });
}

function createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined {
  const colorValues = color.colors;
  switch (override) {
    case FeatureOverrideType.ColorAndAlpha:
      return 255 === colorValues.t ? undefined : color.tbgr;
    case FeatureOverrideType.ColorOnly:
      return ColorDef.from(colorValues.r, colorValues.g, colorValues.b, 255).tbgr;
    case FeatureOverrideType.AlphaOnly:
      return -(colorValues.t / 255);
  }
}

function getOverrideFromKey(key: number): { overrideType: FeatureOverrideType, color: ColorDef } {
  let overrideType;
  let color;

  if (key < 0) {
    color = ColorDef.from(0, 0, 0, 255 * Math.abs(key));
    overrideType = FeatureOverrideType.AlphaOnly;
  } else {
    color = ColorDef.fromJSON(key);
    if (0 === color.getAlpha()) {
      color = color.withAlpha(255);
      overrideType = FeatureOverrideType.ColorOnly;
    } else {
      overrideType = FeatureOverrideType.ColorAndAlpha;
    }
  }

  return { overrideType, color };
}

function getNeverDrawnElements(ref: IModelDisplayReference): Id64Set | undefined {
  return (undefined !== ref.neverDrawnElements && 0 !== ref.neverDrawnElements.size ? ref.neverDrawnElements : undefined);
}

function getAlwaysDrawnElements(ref: IModelDisplayReference): Id64Set | undefined {
  return (undefined !== ref.alwaysDrawnElements && 0 !== ref.alwaysDrawnElements.size ? ref.alwaysDrawnElements : undefined);
}

function getHiddenElements(ref: IModelDisplayReference): Id64Set | undefined {
  return getNeverDrawnElements(ref);
}

function getIsolatedElements(ref: IModelDisplayReference): Id64Set | undefined {
  return (ref.isAlwaysDrawnExclusive ? getAlwaysDrawnElements(ref) : undefined);
}

function getEmphasizedIsolatedElements(state: EmphasizeElementsState): Id64Set | undefined {
  return (undefined !== state.defaultAppearance && undefined !== state.emphasizeIsolated && 0 !== state.emphasizeIsolated.size ? state.emphasizeIsolated : undefined);
}

function getEmphasizedElements(ref: IModelDisplayReference, state: EmphasizeElementsState): Id64Set | undefined {
  return (undefined !== getEmphasizedIsolatedElements(state) ? state.emphasizeIsolated : (undefined !== state.defaultAppearance && !ref.isAlwaysDrawnExclusive ? getAlwaysDrawnElements(ref) : undefined));
}

function getOverriddenElements(state: EmphasizeElementsState): Map<number, Id64Set> | undefined {
  return (undefined !== state.overrideAppearance && 0 !== state.overrideAppearance.size ? state.overrideAppearance : undefined);
}

function getOverriddenElementsByKey(state: EmphasizeElementsState, key: number): Id64Set | undefined {
  return (undefined !== state.overrideAppearance ? state.overrideAppearance.get(key) : undefined);
}

function clearNeverDrawnElements(ref: IModelDisplayReference): boolean {
  if (undefined === getNeverDrawnElements(ref))
    return false;

  ref.neverDrawnElements.clear();
  ref.invalidateSymbologyOverrides();
  return true;
}

function clearAlwaysDrawnElements(ref: IModelDisplayReference): boolean {
  if (undefined === getAlwaysDrawnElements(ref))
    return false;

  ref.alwaysDrawnElements.clear();
  ref.isAlwaysDrawnExclusive = false;
  ref.invalidateSymbologyOverrides();
  return true;
}

function clearHiddenElements(ref: IModelDisplayReference): boolean {
  return clearNeverDrawnElements(ref);
}

function clearIsolatedElements(ref: IModelDisplayReference, state: EmphasizeElementsState): boolean {
  if (undefined === getIsolatedElements(ref))
    return false;
  if (clearEmphasizedIsolatedElements(ref, state, true))
    return true;
  return clearAlwaysDrawnElements(ref);
}

function clearEmphasizedElements(ref: IModelDisplayReference, state: EmphasizeElementsState): boolean {
  if (undefined === getEmphasizedElements(ref, state))
    return false;

  if (clearEmphasizedIsolatedElements(ref, state, false))
    return true;

  if (!clearAlwaysDrawnElements(ref))
    return false;

  state.defaultAppearance = undefined;
  ref.invalidateSymbologyOverrides();
  return true;
}

function clearEmphasizedIsolatedElements(ref: IModelDisplayReference, state: EmphasizeElementsState, setToAlwaysDrawn: boolean): boolean {
  const emphasizedIsolated = getEmphasizedIsolatedElements(state);
  state.emphasizeIsolated = undefined;
  if (undefined === emphasizedIsolated)
    return false;

  if (setToAlwaysDrawn && setAlwaysDrawnElements(emphasizedIsolated, ref, false))
    return true;

  state.defaultAppearance = undefined;
  ref.invalidateSymbologyOverrides();
  return true;
}

function clearOverriddenElements(ref: IModelDisplayReference, state: EmphasizeElementsState, keyOrIds?: number | Id64Arg): boolean {
  if (undefined === state.overrideAppearance)
    return false;

  if (undefined !== keyOrIds) {
    if (typeof keyOrIds === "number") {
      if (!state.overrideAppearance.delete(keyOrIds))
        return false;
    } else {
      let changed = false;

      for (const [otherKey, otherIds] of state.overrideAppearance) {
        const oldSize = otherIds.size;
        for (const id of Id64.iterable(keyOrIds))
          otherIds.delete(id);

        if (oldSize !== otherIds.size)
          changed = true;

        if (0 === otherIds.size)
          state.overrideAppearance.delete(otherKey);
      }

      if (!changed)
        return false;
    }
  } else {
    state.overrideAppearance = undefined;
  }
  ref.invalidateSymbologyOverrides();
  return true;
}

function updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined {
  const newIds = new Set<string>();
  for (const id of Id64.iterable(ids))
    newIds.add(id);

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

function setNeverDrawnElements(ids: Id64Arg, ref: IModelDisplayReference, replace: boolean = true): boolean {
  const hiddenIds = updateIdSet(ids, replace, ref.neverDrawnElements);
  if (undefined === hiddenIds)
    return false;

  ref.neverDrawnElements.clear();
  ref.neverDrawnElements.addAll(hiddenIds);
  ref.invalidateSymbologyOverrides();
  return true;
}

function setAlwaysDrawnElements(ids: Id64Arg, ref: IModelDisplayReference, exclusive: boolean = true, replace: boolean = true): boolean {
  const visibleIds = updateIdSet(ids, replace, ref.alwaysDrawnElements);
  if (undefined === visibleIds)
    return false;

  ref.alwaysDrawnElements.clear();
  ref.alwaysDrawnElements.addAll(visibleIds);
  ref.isAlwaysDrawnExclusive = exclusive;
  ref.invalidateSymbologyOverrides();
  return true;
}

function hideElements(ids: Id64Arg, ref: IModelDisplayReference, replace: boolean = false): boolean {
  return setNeverDrawnElements(ids, ref, replace);
}

function hideSelectedElements(ref: IModelDisplayReference, replace: boolean = false, clearSelection: boolean = true): boolean {
  const selection = ref.iModel.selectionSet;
  if (!selection.isActive || !hideElements(selection.elements, ref, replace))
    return false;
  if (clearSelection)
    selection.emptyAll();
  return true;
}

function isolateElements(ids: Id64Arg, ref: IModelDisplayReference, state: EmphasizeElementsState, replace: boolean = true): boolean {
  const wasEmphasized = (undefined !== getEmphasizedElements(ref, state));
  if (!setAlwaysDrawnElements(ids, ref, true, replace))
    return false;

  if (wasEmphasized)
    state.defaultAppearance = state.emphasizeIsolated = undefined;

  return true;
}

function isolateSelectedElements(ref: IModelDisplayReference, state: EmphasizeElementsState, replace: boolean = true, clearSelection: boolean = true): boolean {
  const selection = ref.iModel.selectionSet;
  if (!selection.isActive || !isolateElements(selection.elements, ref, state, replace))
    return false;
  if (clearSelection)
    selection.emptyAll();
  return true;
}

function emphasizeElements(ids: Id64Arg, ref: IModelDisplayReference, state: EmphasizeElementsState, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
  if (undefined !== getIsolatedElements(ref)) {
    const emphasizeIds = updateIdSet(ids, replace, state.emphasizeIsolated);
    if (undefined === emphasizeIds)
      return false;

    state.emphasizeIsolated = emphasizeIds;
    ref.invalidateSymbologyOverrides();
  } else {
    if (!setAlwaysDrawnElements(ids, ref, false, replace))
      return false;

    state.emphasizeIsolated = undefined;
  }

  state.defaultAppearance = (undefined === defaultAppearance ? FeatureAppearance.fromJSON({ rgb: new RgbColor(0xe4, 0xe4, 0xe4), transparency: 0.8, nonLocatable: true }) : defaultAppearance);
  return true;
}

function emphasizeSelectedElements(ref: IModelDisplayReference, state: EmphasizeElementsState, defaultAppearance?: FeatureAppearance, replace: boolean = true, clearSelection: boolean = true): boolean {
  const selection = ref.iModel.selectionSet;
  if (!selection.isActive || !emphasizeElements(selection.elements, ref, state, defaultAppearance, replace))
    return false;

  if (clearSelection)
    selection.emptyAll();

  return true;
}

function overrideElements(ids: Id64Arg, ref: IModelDisplayReference, state: EmphasizeElementsState, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
  const ovrKey = createOverrideKey(color, override);
  if (undefined === ovrKey)
    return false;

  const overrideIds = new Set<string>();
  for (const id of Id64.iterable(ids))
    overrideIds.add(id);

  if (0 === overrideIds.size)
    return false;

  const existingIds = (!replace ? getOverriddenElementsByKey(state, ovrKey) : undefined);
  const oldSize = (undefined !== existingIds ? existingIds.size : 0);
  if (0 !== oldSize && undefined !== existingIds)
    for (const id of existingIds)
      overrideIds.add(id);

  if (oldSize === overrideIds.size)
    return false;

  if (undefined === state.overrideAppearance) {
    state.overrideAppearance = new Map<number, Id64Set>();
  } else {
    for (const [key, otherIds] of state.overrideAppearance) {
      if (key === ovrKey)
        continue;

      for (const id of Id64.iterable(ids))
        otherIds.delete(id);

      if (0 !== otherIds.size)
        continue;

      state.overrideAppearance.delete(key);
    }
  }

  state.overrideAppearance.set(ovrKey, overrideIds);
  ref.invalidateSymbologyOverrides();
  return true;
}

function overrideSelectedElements(ref: IModelDisplayReference, state: EmphasizeElementsState, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false, clearSelection: boolean = true): boolean {
  const selection = ref.iModel.selectionSet;
  if (!selection.isActive || !overrideElements(selection.elements, ref, state, color, override, replace))
    return false;
  if (clearSelection)
    selection.emptyAll();
  return true;
}

function isActive(ref: IModelDisplayReference, state: EmphasizeElementsState): boolean {
  return undefined !== state.defaultAppearance || undefined !== getNeverDrawnElements(ref) || undefined !== getAlwaysDrawnElements(ref) || undefined !== getOverriddenElements(state);
}

function toJSON(ref: IModelDisplayReference, state: EmphasizeElementsState): EmphasizeElementsProps {
  const props: EmphasizeElementsProps = {};
  const neverDrawn = getNeverDrawnElements(ref);
  if (undefined !== neverDrawn)
    props.neverDrawn = [...neverDrawn];

  const alwaysDrawn = getAlwaysDrawnElements(ref);
  if (undefined !== alwaysDrawn)
    props.alwaysDrawn = [...alwaysDrawn];

  if (ref.isAlwaysDrawnExclusive)
    props.isAlwaysDrawnExclusive = true;

  const alwaysDrawnExclusiveEmphasized = getEmphasizedIsolatedElements(state);
  if (undefined !== alwaysDrawnExclusiveEmphasized)
    props.alwaysDrawnExclusiveEmphasized = [...alwaysDrawnExclusiveEmphasized];

  if (undefined !== state.defaultAppearance)
    props.defaultAppearance = state.defaultAppearance;

  if (state.unanimatedAppearance)
    props.unanimatedAppearance = state.unanimatedAppearance;

  const overriddenElements = getOverriddenElements(state);
  if (undefined !== overriddenElements) {
    const appearanceOverride: AppearanceOverrideProps[] = [];
    for (const [key, ovrIds] of overriddenElements) {
      const { color, overrideType } = { ...getOverrideFromKey(key) };
      const ids = [...ovrIds];
      appearanceOverride.push({ overrideType, color: color.toJSON(), ids });
    }

    props.appearanceOverride = appearanceOverride;
  }

  if (state.wantEmphasis)
    props.wantEmphasis = true;

  return props;
}

function fromJSON(props: EmphasizeElementsProps, ref: IModelDisplayReference, state: EmphasizeElementsState): boolean {
  let changed = false;
  if (undefined !== props.neverDrawn && setNeverDrawnElements(new Set<string>(props.neverDrawn), ref, true))
    changed = true;

  if (undefined !== props.alwaysDrawn && setAlwaysDrawnElements(new Set<string>(props.alwaysDrawn), ref, undefined !== props.isAlwaysDrawnExclusive && props.isAlwaysDrawnExclusive))
    changed = true;

  if (undefined !== props.alwaysDrawnExclusiveEmphasized)
    state.emphasizeIsolated = new Set<string>(props.alwaysDrawnExclusiveEmphasized);

  if (undefined !== props.defaultAppearance) {
    const defaultAppearance = FeatureAppearance.fromJSON(props.defaultAppearance);
    if (undefined === state.defaultAppearance || !state.defaultAppearance.equals(defaultAppearance))
      changed = true;
    state.defaultAppearance = defaultAppearance;
  }

  if (props.unanimatedAppearance)
    state.unanimatedAppearance = FeatureAppearance.fromJSON(props.unanimatedAppearance);

  if (undefined !== props.appearanceOverride) {
    for (const ovrApp of props.appearanceOverride) {
      if (undefined === ovrApp.ids)
        continue;

      if (overrideElements(new Set<string>(ovrApp.ids), ref, state, ColorDef.fromJSON(ovrApp.color), ovrApp.overrideType, true))
        changed = true;
    }
  }

  const wantEmphasis = true === props.wantEmphasis;
  if (wantEmphasis !== state.wantEmphasis) {
    state.wantEmphasis = wantEmphasis;
    changed = true;
  }

  return changed;
}

/** An implementation of [[FeatureOverrideProvider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 * @public
 * @extensions
 */
export class EmphasizeElements implements FeatureOverrideProvider {
  readonly #state: EmphasizeElementsState = {
    emphasizedAppearance: FeatureAppearance.fromJSON({ emphasized: true }),
    wantEmphasis: false,
  };

  /** If true, all overridden and emphasized elements will also have the "emphasis" effect applied to them. This causes them to be hilited using the current [[Viewport.emphasisSettings]]. */
  public get wantEmphasis(): boolean { return this.#state.wantEmphasis; }
  public set wantEmphasis(value: boolean) { this.#state.wantEmphasis = value; }

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides.
   * @see [[Viewport.addFeatureOverrideProvider]]
   */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, vp: Viewport): void {
    addFeatureOverrides(overrides, vp.primaryIModelRef, this.#state);
  }

  /** @internal */
  public createAppearanceFromKey(key: number): FeatureAppearance {
    return createAppearanceFromKey(key, this.#state);
  }

  /** Get override key from color and override type */
  public createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined {
    return createOverrideKey(color, override);
  }

  /** Get color and override type for the given key. */
  public getOverrideFromKey(key: number): { overrideType: FeatureOverrideType, color: ColorDef } {
    return getOverrideFromKey(key);
  }

  /** Establish a default appearance to apply to elements without overrides. If changing the default appearance
   * without also calling emphasizeElements/overrideElements, an explicit refresh must be requested for the change to take effect.
   * @note Setting this to `undefined` to undo [[emphasizeElements]] or [[isolateElements]] leaves the always-drawn/isolated
   * element IDs in place but invisible to [[getEmphasizedElements]], [[getEmphasizedIsolatedElements]], and [[clearEmphasizedElements]].
   * Prefer [[clearEmphasizedElements]] or [[clearEmphasizedIsolatedElements]] to undo emphasis, which clear both together.
   * @see [[Viewport.setFeatureOverrideProviderChanged]]
   */
  public get defaultAppearance(): FeatureAppearance | undefined { return this.#state.defaultAppearance; }
  public set defaultAppearance(appearance: FeatureAppearance | undefined) { this.#state.defaultAppearance = appearance; }

  /** Establish a default appearance to apply to elements that are not animated by the view's [RenderSchedule.Script]($common).
   * @note If this is the only change made to EmphasizeElements, you must call [[Viewport.setFeatureOverrideProviderChanged]] for
   * the change to take immediate effect.
   * @see [[createDefaultAppearance]] to create an appearance suitable for de-emphasizing the non-animated elements.
   */
  public get unanimatedAppearance(): FeatureAppearance | undefined {
    return this.#state.unanimatedAppearance;
  }
  public set unanimatedAppearance(appearance: FeatureAppearance | undefined) {
    this.#state.unanimatedAppearance = appearance;
  }

  /** Create default appearance to use for emphasizeElements when not supplied by caller. */
  public createDefaultAppearance(): FeatureAppearance {
    return FeatureAppearance.fromJSON({
      rgb: new RgbColor(0xe4, 0xe4, 0xe4),
      transparency: 0.8,
      nonLocatable: true,
    });
  }

  /** Get the IDs of the currently never drawn elements. */
  public getNeverDrawnElements(vp: Viewport): Id64Set | undefined {
    return getNeverDrawnElements(vp.primaryIModelRef);
  }

  /** Get the IDs of the currently always drawn elements. */
  public getAlwaysDrawnElements(vp: Viewport): Id64Set | undefined {
    return getAlwaysDrawnElements(vp.primaryIModelRef);
  }

  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(vp: Viewport): Id64Set | undefined {
    return getHiddenElements(vp.primaryIModelRef);
  }

  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(vp: Viewport): Id64Set | undefined {
    return getIsolatedElements(vp.primaryIModelRef);
  }

  /** Get the IDs of the currently emphasized isolated elements. */
  public getEmphasizedIsolatedElements(): Id64Set | undefined {
    return getEmphasizedIsolatedElements(this.#state);
  }

  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(vp: Viewport): Id64Set | undefined {
    return getEmphasizedElements(vp.primaryIModelRef, this.#state);
  }

  /** Get the map of current elements with color/transparency overrides. */
  public getOverriddenElements(): Map<number, Id64Set> | undefined {
    return getOverriddenElements(this.#state);
  }

  /** Get the IDs of current elements with the specified color/transparency override. */
  public getOverriddenElementsByKey(key: number): Id64Set | undefined {
    return getOverriddenElementsByKey(this.#state, key);
  }

  /** Clear never drawn elements.
   * @return false if nothing to clear.
   */
  public clearNeverDrawnElements(vp: Viewport): boolean {
    return clearNeverDrawnElements(vp.primaryIModelRef);
  }

  /** Clear always drawn elements.
   * @return false if nothing to clear.
   */
  public clearAlwaysDrawnElements(vp: Viewport): boolean {
    return clearAlwaysDrawnElements(vp.primaryIModelRef);
  }

  /** Clear hidden elements.
   * @return false if nothing to clear.
   */
  public clearHiddenElements(vp: Viewport): boolean {
    return clearHiddenElements(vp.primaryIModelRef);
  }

  /** Clear isolated elements.
   * @return false if nothing to clear.
   */
  public clearIsolatedElements(vp: Viewport): boolean {
    return clearIsolatedElements(vp.primaryIModelRef, this.#state);
  }

  /** Clear emphasized elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedElements(vp: Viewport): boolean {
    return clearEmphasizedElements(vp.primaryIModelRef, this.#state);
  }

  /** Clear emphasized isolated elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedIsolatedElements(vp: Viewport, setToAlwaysDrawn: boolean): boolean {
    return clearEmphasizedIsolatedElements(vp.primaryIModelRef, this.#state, setToAlwaysDrawn);
  }

  /** Clear color/transparency overrides from elements. Removes all overrides when keyOrIds isn't supplied.
   * @param keyOrIds Specify a key value from [[EmphasizeElements.getOverriddenElements]] or [[EmphasizeElements.createOverrideKey]]
   * to remove a single color/transparency override for the corresponding elements or specify the IDs of elements to
   * remove any color/transparency override from.
   * @return false if nothing to clear.
   */
  public clearOverriddenElements(vp: Viewport, keyOrIds?: number | Id64Arg): boolean {
    return clearOverriddenElements(vp.primaryIModelRef, this.#state, keyOrIds);
  }

  /** @internal */
  public updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined {
    return updateIdSet(ids, replace, existingIds);
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
    return setNeverDrawnElements(ids, vp.primaryIModelRef, replace);
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
    return setAlwaysDrawnElements(ids, vp.primaryIModelRef, exclusive, replace);
  }

  /** Set the element IDs to be never drawn.
   * @param ids The IDs of the elements to never draw.
   * @param vp The viewport.
   * @param replace true to replace currently hidden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.neverDrawn]]
   */
  public hideElements(ids: Id64Arg, vp: Viewport, replace: boolean = false): boolean {
    return hideElements(ids, vp.primaryIModelRef, replace);
  }

  /** Set the currently selected elements to be never drawn.
   * @param vp The viewport.
   * @param replace true to replace currently hidden elements (if any) or false to add to the existing set.
   * @param clearSelection true to clear current selection after setting appearance override, false to leave selected.
   * @return true if overrides were changed.
   * @see [[Viewport.neverDrawn]]
   */
  public hideSelectedElements(vp: Viewport, replace: boolean = false, clearSelection: boolean = true): boolean {
    return hideSelectedElements(vp.primaryIModelRef, replace, clearSelection);
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
    return isolateElements(ids, vp.primaryIModelRef, this.#state, replace);
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
    return isolateSelectedElements(vp.primaryIModelRef, this.#state, replace, clearSelection);
  }

  /** Set the element IDs to be always drawn normally with all other elements in the view overridden to draw using a default appearance.
   * @param ids The IDs of the elements to always draw.
   * @param vp The viewport.
   * @param defaultAppearance Optional default appearance, uses non-locatable transparent grey if not specified.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.alwaysDrawn]]
   * @see [[Viewport.isAlwaysDrawnExclusive]]
   */
  public emphasizeElements(ids: Id64Arg, vp: Viewport, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
    return emphasizeElements(ids, vp.primaryIModelRef, this.#state, defaultAppearance, replace);
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
  public emphasizeSelectedElements(vp: Viewport, defaultAppearance?: FeatureAppearance, replace: boolean = true, clearSelection: boolean = true): boolean {
    return emphasizeSelectedElements(vp.primaryIModelRef, this.#state, defaultAppearance, replace, clearSelection);
  }

  /** Set the element IDs to display with a color/transparency override.
   * @param ids The IDs of the elements.
   * @param vp The viewport.
   * @param color ColorDef to specify override rgb and alpha.
   * @param override Whether to use color and alpha, only color, or only alpha from the supplied ColorDef.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @return true if overrides were changed.
   * @see [[Viewport.addFeatureOverrideProvider]]
   */
  public overrideElements(ids: Id64Arg, vp: Viewport, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
    return overrideElements(ids, vp.primaryIModelRef, this.#state, color, override, replace);
  }

  /** Set the currently selected elements to display with a color/transparency override.
   * @param vp The viewport.
   * @param color ColorDef to specify override rgb and alpha.
   * @param override Whether to use color and alpha, only color, or only alpha from the supplied ColorDef.
   * @param replace true to replace currently overridden elements (if any) or false to add to the existing set.
   * @param clearSelection true to clear current selection after setting appearance override, false to leave selected.
   * @return true if overrides were changed.
   * @see [[Viewport.addFeatureOverrideProvider]]
   */
  public overrideSelectedElements(vp: Viewport, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false, clearSelection: boolean = true): boolean {
    return overrideSelectedElements(vp.primaryIModelRef, this.#state, color, override, replace, clearSelection);
  }

  /** @return true if provider is currently overriding the display of any elements. */
  public isActive(vp: Viewport): boolean {
    return isActive(vp.primaryIModelRef, this.#state);
  }

  /** Serialize to JSON representation.
   * @see [[EmphasizeElements.fromJSON]]
   */
  public toJSON(vp: Viewport): EmphasizeElementsProps {
    return toJSON(vp.primaryIModelRef, this.#state);
  }

  /** Initialize from JSON representation.
   * @see [[EmphasizeElements.toJSON]]
   */
  public fromJSON(props: EmphasizeElementsProps, vp: Viewport): boolean {
    return fromJSON(props, vp.primaryIModelRef, this.#state);
  }

  /** Return the EmphasizeElements provider currently registered with the specified Viewport, if one is already registered. */
  public static get(vp: Viewport): EmphasizeElements | undefined {
    return vp.findFeatureOverrideProviderOfType<EmphasizeElements>(EmphasizeElements);
  }

  /** Return the EmphasizeElements provider currently registered with the specified Viewport, or register a new one and return it. */
  public static getOrCreate(vp: Viewport): EmphasizeElements {
    let provider = this.get(vp);
    if (!provider) {
      provider = new EmphasizeElements();
      vp.addFeatureOverrideProvider(provider);
    }

    return provider;
  }

  /** Drop the EmphasizeElements provider currently registered with the specified Viewport, if any is registered. */
  public static clear(vp: Viewport, inactiveOnly: boolean = false) {
    const provider = this.get(vp);

    if (undefined === provider || (inactiveOnly && provider.isActive(vp)))
      return;

    vp.primaryIModelRef.neverDrawnElements.clear();
    vp.primaryIModelRef.alwaysDrawnElements.clear();
    vp.dropFeatureOverrideProvider(provider);
  }
}

/** An implementation of [[FeatureSymbologyOverrider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 * @beta
 */
export class EmphasizeIModelElements implements FeatureSymbologyOverrider {
  readonly #iModelRef: IModelDisplayReference;
  readonly #state: EmphasizeElementsState = {
    emphasizedAppearance: FeatureAppearance.fromJSON({ emphasized: true }),
    wantEmphasis: false,
  };

  private constructor(iModelRef: IModelDisplayReference) {
    this.#iModelRef = iModelRef;
  }

  /** If true, all overridden and emphasized elements will also have the "emphasis" effect applied to them. */
  public get wantEmphasis(): boolean { return this.#state.wantEmphasis; }
  public set wantEmphasis(value: boolean) { this.#state.wantEmphasis = value; }

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides. */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides): void {
    addFeatureOverrides(overrides, this.#iModelRef, this.#state);
  }

  /** @internal */
  public createAppearanceFromKey(key: number): FeatureAppearance {
    return createAppearanceFromKey(key, this.#state);
  }

  /** Get override key from color and override type */
  public createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined {
    return createOverrideKey(color, override);
  }

  /** Get color and override type for the given key. */
  public getOverrideFromKey(key: number): { overrideType: FeatureOverrideType, color: ColorDef } {
    return getOverrideFromKey(key);
  }

  /** Establish a default appearance to apply to elements without overrides.
   * without also calling emphasizeElements/overrideElements, an explicit refresh must be requested for the change to take effect.
   * @note Setting this to `undefined` to undo [[emphasizeElements]] or [[isolateElements]] leaves the always-drawn/isolated
   * element IDs in place but invisible to [[getEmphasizedElements]], [[getEmphasizedIsolatedElements]], and [[clearEmphasizedElements]].
   * Prefer [[clearEmphasizedElements]] or [[clearEmphasizedIsolatedElements]] to undo emphasis, which clear both together.
   * @see [[IModelDisplayReference.invalidateSymbologyOverrides]].
   */
  public get defaultAppearance(): FeatureAppearance | undefined { return this.#state.defaultAppearance; }
  public set defaultAppearance(appearance: FeatureAppearance | undefined) { this.#state.defaultAppearance = appearance; }

  /** Establish a default appearance to apply to elements that are not animated by the view's [RenderSchedule.Script]($common). */
  public get unanimatedAppearance(): FeatureAppearance | undefined {
    return this.#state.unanimatedAppearance;
  }
  public set unanimatedAppearance(appearance: FeatureAppearance | undefined) {
    this.#state.unanimatedAppearance = appearance;
  }

  /** Create default appearance to use for emphasizeElements when not supplied by caller. */
  public createDefaultAppearance(): FeatureAppearance {
    return FeatureAppearance.fromJSON({
      rgb: new RgbColor(0xe4, 0xe4, 0xe4),
      transparency: 0.8,
      nonLocatable: true,
    });
  }

  /** Get the IDs of the currently never drawn elements. */
  public getNeverDrawnElements(): Id64Set | undefined {
    return getNeverDrawnElements(this.#iModelRef);
  }

  /** Get the IDs of the currently always drawn elements. */
  public getAlwaysDrawnElements(): Id64Set | undefined {
    return getAlwaysDrawnElements(this.#iModelRef);
  }

  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(): Id64Set | undefined {
    return getHiddenElements(this.#iModelRef);
  }

  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(): Id64Set | undefined {
    return getIsolatedElements(this.#iModelRef);
  }

  /** Get the IDs of the currently emphasized isolated elements. */
  public getEmphasizedIsolatedElements(): Id64Set | undefined {
    return getEmphasizedIsolatedElements(this.#state);
  }

  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(): Id64Set | undefined {
    return getEmphasizedElements(this.#iModelRef, this.#state);
  }

  /** Get the map of current elements with color/transparency overrides. */
  public getOverriddenElements(): Map<number, Id64Set> | undefined {
    return getOverriddenElements(this.#state);
  }

  /** Get the IDs of current elements with the specified color/transparency override. */
  public getOverriddenElementsByKey(key: number): Id64Set | undefined {
    return getOverriddenElementsByKey(this.#state, key);
  }

  /** Clear never drawn elements. */
  public clearNeverDrawnElements(): boolean {
    return clearNeverDrawnElements(this.#iModelRef);
  }

  /** Clear always drawn elements. */
  public clearAlwaysDrawnElements(): boolean {
    return clearAlwaysDrawnElements(this.#iModelRef);
  }

  /** Clear hidden elements. */
  public clearHiddenElements(): boolean {
    return clearHiddenElements(this.#iModelRef);
  }

  /** Clear isolated elements. */
  public clearIsolatedElements(): boolean {
    return clearIsolatedElements(this.#iModelRef, this.#state);
  }

  /** Clear emphasized elements. */
  public clearEmphasizedElements(): boolean {
    return clearEmphasizedElements(this.#iModelRef, this.#state);
  }

  /** Clear emphasized isolated elements. */
  public clearEmphasizedIsolatedElements(setToAlwaysDrawn: boolean): boolean {
    return clearEmphasizedIsolatedElements(this.#iModelRef, this.#state, setToAlwaysDrawn);
  }

  /** Clear color/transparency overrides from elements. */
  public clearOverriddenElements(keyOrIds?: number | Id64Arg): boolean {
    return clearOverriddenElements(this.#iModelRef, this.#state, keyOrIds);
  }

  /** @internal */
  public updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined {
    return updateIdSet(ids, replace, existingIds);
  }

  /** Set the element IDs to be never drawn. */
  public setNeverDrawnElements(ids: Id64Arg, replace: boolean = true): boolean {
    return setNeverDrawnElements(ids, this.#iModelRef, replace);
  }

  /** Set the element IDs to be always drawn. */
  public setAlwaysDrawnElements(ids: Id64Arg, exclusive: boolean = true, replace: boolean = true): boolean {
    return setAlwaysDrawnElements(ids, this.#iModelRef, exclusive, replace);
  }

  /** Set the element IDs to be never drawn. */
  public hideElements(ids: Id64Arg, replace: boolean = false): boolean {
    return hideElements(ids, this.#iModelRef, replace);
  }

  /** Set the element IDs to be always drawn exclusively. */
  public isolateElements(ids: Id64Arg, replace: boolean = true): boolean {
    return isolateElements(ids, this.#iModelRef, this.#state, replace);
  }

  /** Set the element IDs to be always drawn normally with all other elements in the view overridden to draw using a default appearance. */
  public emphasizeElements(ids: Id64Arg, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
    return emphasizeElements(ids, this.#iModelRef, this.#state, defaultAppearance, replace);
  }

  /** Set the element IDs to display with a color/transparency override. */
  public overrideElements(ids: Id64Arg, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
    return overrideElements(ids, this.#iModelRef, this.#state, color, override, replace);
  }

  /** Set the currently selected elements to be always drawn exclusively. */
  public isolateSelectedElements(ref: IModelDisplayReference, replace: boolean = true, clearSelection: boolean = true): boolean {
    return isolateSelectedElements(ref, this.#state, replace, clearSelection);
  }

  /** Set the currently selected elements to be always drawn normally with all other elements in the view overridden to draw using a default appearance. */
  public emphasizeSelectedElements(ref: IModelDisplayReference, defaultAppearance?: FeatureAppearance, replace: boolean = true, clearSelection: boolean = true): boolean {
    return emphasizeSelectedElements(ref, this.#state, defaultAppearance, replace, clearSelection);
  }

  /** Set the currently selected elements to display with a color/transparency override. */
  public overrideSelectedElements(ref: IModelDisplayReference, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false, clearSelection: boolean = true): boolean {
    return overrideSelectedElements(ref, this.#state, color, override, replace, clearSelection);
  }

  /** @return true if provider is currently overriding the display of any elements. */
  public get isActive(): boolean {
    return isActive(this.#iModelRef, this.#state);
  }

  /** Serialize to JSON representation. */
  public toJSON(): EmphasizeElementsProps {
    return toJSON(this.#iModelRef, this.#state);
  }

  /** Initialize from JSON representation. */
  public fromJSON(props: EmphasizeElementsProps): boolean {
    return fromJSON(props, this.#iModelRef, this.#state);
  }

  /** Return the EmphasizeIModelElements provider currently registered with the specified IModelDisplayReference, if one is already registered. */
  public static get(ref: IModelDisplayReference): EmphasizeIModelElements | undefined {
    for (const provider of ref.featureOverrideProviders)
      if (provider instanceof EmphasizeIModelElements)
        return provider;

    return undefined;
  }

  /** Return the EmphasizeIModelElements provider currently registered with the specified IModelDisplayReference, or register a new one and return it. */
  public static getOrCreate(ref: IModelDisplayReference): EmphasizeIModelElements {
    let provider = this.get(ref);
    if (!provider) {
      provider = new EmphasizeIModelElements(ref);
      ref.featureOverrideProviders.add(provider);
    }

    return provider;
  }

  /** Drop the EmphasizeIModelElements provider currently registered with the specified IModelDisplayReference, if any is registered. */
  public static clear(ref: IModelDisplayReference, inactiveOnly: boolean = false): void {
    const provider = this.get(ref);

    if (undefined === provider || (inactiveOnly && provider.isActive))
      return;

    ref.neverDrawnElements.clear();
    ref.alwaysDrawnElements.clear();
    ref.featureOverrideProviders.delete(provider);
  }
}
