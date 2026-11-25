/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64, Id64Arg, Id64Set } from "@itwin/core-bentley";
import { _ignoreAnimationOverridesExcept, ColorDef, EmphasizeElementsProps, FeatureAppearance, FeatureOverrideType, RgbColor } from "@itwin/core-common";
import { IModelDisplayReference } from "./IModelDisplayReference";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { FeatureOverrideProvider, IModelDisplayReferenceFeatureOverrideProvider } from "./FeatureOverrideProvider";
import { Viewport } from "./Viewport";

interface EmphasizeElementsState {
  defaultAppearance?: FeatureAppearance;
  unanimatedAppearance?: FeatureAppearance;
  emphasizeIsolated?: Id64Set;
  overrideAppearance?: Map<number, Id64Set>;
  wantEmphasis: boolean;
  emphasizedAppearance: FeatureAppearance;
}

/** Shared hook surface for EmphasizeElements (which dispatches through virtual methods) and EmphasizeIModelElements. */
interface EmphasizeOps {
  readonly state: EmphasizeElementsState;
  readonly ref: IModelDisplayReference;
  readonly wantEmphasis: boolean;
  defaultAppearance: FeatureAppearance | undefined;
  unanimatedAppearance: FeatureAppearance | undefined;
  createDefaultAppearance(): FeatureAppearance;
  createAppearanceFromKey(key: number): FeatureAppearance;
  createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined;
  getOverrideFromKey(key: number): { overrideType: FeatureOverrideType, color: ColorDef };
  getNeverDrawnElements(): Id64Set | undefined;
  getAlwaysDrawnElements(): Id64Set | undefined;
  getIsolatedElements(): Id64Set | undefined;
  getEmphasizedIsolatedElements(): Id64Set | undefined;
  getEmphasizedElements(): Id64Set | undefined;
  getOverriddenElements(): Map<number, Id64Set> | undefined;
  getOverriddenElementsByKey(key: number): Id64Set | undefined;
  clearAlwaysDrawnElements(): boolean;
  clearEmphasizedIsolatedElements(setToAlwaysDrawn: boolean): boolean;
  updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined;
  setNeverDrawnElements(ids: Id64Arg, replace?: boolean): boolean;
  setAlwaysDrawnElements(ids: Id64Arg, exclusive?: boolean, replace?: boolean): boolean;
  overrideElements(ids: Id64Arg, color: ColorDef, override?: FeatureOverrideType, replace?: boolean): boolean;
  notifyChanged(): void;
}

const defaultEmphasizeAppearance = FeatureAppearance.fromJSON({ rgb: new RgbColor(0xe4, 0xe4, 0xe4), transparency: 0.8, nonLocatable: true });

// Pass JSON's empty-exclusive state through the virtual setter without changing normal empty-input calls.
class RestoredAlwaysDrawnIds extends Set<string> { }

function createState(): EmphasizeElementsState {
  return {
    emphasizedAppearance: FeatureAppearance.fromJSON({ emphasized: true }),
    wantEmphasis: false,
  };
}

function createDefaultAppearance(): FeatureAppearance {
  return FeatureAppearance.fromJSON({
    rgb: new RgbColor(0xe4, 0xe4, 0xe4),
    transparency: 0.8,
    nonLocatable: true,
  });
}

function createAppearanceFromKey(ops: Pick<EmphasizeOps, "getOverrideFromKey" | "wantEmphasis">, key: number): FeatureAppearance {
  const { color, overrideType } = ops.getOverrideFromKey(key);
  return FeatureAppearance.fromJSON({
    rgb: overrideType === FeatureOverrideType.AlphaOnly ? undefined : RgbColor.fromColorDef(color),
    transparency: overrideType === FeatureOverrideType.ColorOnly ? undefined : color.getTransparency() / 255,
    emphasized: ops.wantEmphasis || undefined,
  });
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

function addFeatureOverrides(ops: EmphasizeOps, overrides: FeatureSymbology.Overrides): void {
  const defaultAppearance = ops.defaultAppearance;
  if (defaultAppearance)
    overrides.setDefaultOverrides(defaultAppearance);

  const emphasized = ops.getEmphasizedElements();
  if (emphasized) {
    const appearance = ops.wantEmphasis ? ops.state.emphasizedAppearance : FeatureAppearance.defaults;
    const args = { elementId: "", appearance };
    for (const elementId of emphasized) {
      args.elementId = elementId;
      overrides.override(args);
    }

    overrides[_ignoreAnimationOverridesExcept](emphasized);
  }

  const overridden = ops.getOverriddenElements();
  if (overridden) {
    const args = { elementId: "", appearance: FeatureAppearance.defaults };
    for (const [key, ids] of overridden) {
      args.appearance = ops.createAppearanceFromKey(key);
      for (const elementId of ids) {
        args.elementId = elementId;
        overrides.override(args);
      }
    }
  }

  const unanimated = ops.unanimatedAppearance;
  if (unanimated) {
    if (unanimated.isFullyTransparent)
      overrides.neverDrawnAnimationNodes.add(0);
    else
      overrides.animationNodeOverrides.set(0, unanimated);
  }
}

function clearNeverDrawnElements(ops: EmphasizeOps): boolean {
  if (undefined === ops.getNeverDrawnElements())
    return false;

  const hadEntries = 0 < ops.ref.neverDrawnElements.size;
  ops.ref.neverDrawnElements.clear();
  if (!hadEntries)
    ops.ref.invalidateSymbologyOverrides();
  return true;
}

function clearAlwaysDrawnElements(ops: EmphasizeOps): boolean {
  const ref = ops.ref;
  if (!ref.isAlwaysDrawnExclusive && undefined === ops.getAlwaysDrawnElements())
    return false;

  const changed = 0 < ref.alwaysDrawnElements.size || ref.isAlwaysDrawnExclusive;
  ref.alwaysDrawnElements.clear();
  ref.isAlwaysDrawnExclusive = false;
  if (!changed)
    ref.invalidateSymbologyOverrides();
  return true;
}

function clearIsolatedElements(ops: EmphasizeOps): boolean {
  if (undefined === ops.getIsolatedElements() && !(ops.ref.isAlwaysDrawnExclusive && !ops.ref.alwaysDrawnElements.size))
    return false;

  return ops.clearEmphasizedIsolatedElements(true) || ops.clearAlwaysDrawnElements();
}

function clearEmphasizedElements(ops: EmphasizeOps): boolean {
  if (undefined === ops.getEmphasizedElements())
    return false;

  if (ops.clearEmphasizedIsolatedElements(false))
    return true;

  if (!ops.clearAlwaysDrawnElements())
    return false;

  ops.defaultAppearance = undefined;
  ops.notifyChanged();
  return true;
}

function clearEmphasizedIsolatedElements(ops: EmphasizeOps, setToAlwaysDrawn: boolean): boolean {
  const emphasized = ops.getEmphasizedIsolatedElements();
  ops.state.emphasizeIsolated = undefined;
  if (undefined === emphasized)
    return false;

  if (!setToAlwaysDrawn || !ops.setAlwaysDrawnElements(emphasized, false))
    ops.defaultAppearance = undefined;
  ops.notifyChanged();
  return true;
}

function clearOverriddenElements(ops: EmphasizeOps, keyOrIds?: number | Id64Arg): boolean {
  const state = ops.state;
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

  ops.notifyChanged();
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

// Empty ID arrays are omitted from JSON, but exclusive + empty means hide everything.
function setEmptyExclusive(ref: IModelDisplayReference): boolean {
  if (ref.isAlwaysDrawnExclusive && !ref.alwaysDrawnElements.size)
    return false;
  ref.alwaysDrawnElements.clear();
  ref.isAlwaysDrawnExclusive = true;
  return true;
}

function setNeverDrawnElements(ops: EmphasizeOps, ids: Id64Arg, replace: boolean = true): boolean {
  const target = ops.ref.neverDrawnElements;
  const hidden = ops.updateIdSet(ids, replace, target);
  if (undefined === hidden)
    return false;

  if (hidden !== target) {
    target.clear();
    target.addAll(hidden);
  } else {
    ops.ref.invalidateSymbologyOverrides();
  }
  return true;
}

function setAlwaysDrawnElements(ops: EmphasizeOps, ids: Id64Arg, exclusive: boolean = true, replace: boolean = true): boolean {
  const ref = ops.ref;
  if (replace && exclusive && ids instanceof RestoredAlwaysDrawnIds && !ids.size)
    return setEmptyExclusive(ref);

  const target = ref.alwaysDrawnElements;
  const visible = ops.updateIdSet(ids, replace, target);
  if (undefined === visible)
    return false;

  const changedExclusive = ref.isAlwaysDrawnExclusive !== exclusive;
  if (visible !== target) {
    target.clear();
    target.addAll(visible);
  }
  ref.isAlwaysDrawnExclusive = exclusive;
  if (visible === target && !changedExclusive)
    ref.invalidateSymbologyOverrides();
  return true;
}

function isolateElements(ops: EmphasizeOps, ids: Id64Arg, replace: boolean = true): boolean {
  const wasEmphasized = undefined !== ops.getEmphasizedElements();
  if (!ops.setAlwaysDrawnElements(ids, true, replace))
    return false;

  if (wasEmphasized) {
    ops.defaultAppearance = undefined;
    ops.state.emphasizeIsolated = undefined;
  }

  return true;
}

function emphasizeElements(ops: EmphasizeOps, ids: Id64Arg, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
  if (undefined !== ops.getIsolatedElements()) {
    const emphasized = ops.updateIdSet(ids, replace, ops.state.emphasizeIsolated);
    if (undefined === emphasized)
      return false;

    ops.state.emphasizeIsolated = emphasized;
  } else {
    if (!ops.setAlwaysDrawnElements(ids, false, replace))
      return false;

    ops.state.emphasizeIsolated = undefined;
  }

  ops.defaultAppearance = defaultAppearance ?? ops.createDefaultAppearance();
  ops.notifyChanged();
  return true;
}

function overrideElements(ops: EmphasizeOps, ids: Id64Arg, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
  const key = ops.createOverrideKey(color, override);
  if (undefined === key)
    return false;
  const requestedIds = Id64.toIdSet(ids, true);
  if (0 === requestedIds.size)
    return false;

  const existingIds = replace ? undefined : ops.getOverriddenElementsByKey(key);
  const overrideIds = new Set(requestedIds);
  const oldSize = existingIds?.size ?? 0;
  if (existingIds)
    for (const id of existingIds)
      overrideIds.add(id);
  if (oldSize === overrideIds.size)
    return false;

  ops.state.overrideAppearance ??= new Map<number, Id64Set>();
  for (const [otherKey, otherIds] of ops.state.overrideAppearance) {
    if (otherKey === key)
      continue;
    for (const id of requestedIds)
      otherIds.delete(id);
    if (0 === otherIds.size)
      ops.state.overrideAppearance.delete(otherKey);
  }
  ops.state.overrideAppearance.set(key, overrideIds);
  ops.notifyChanged();
  return true;
}

function applyToSelection(ref: IModelDisplayReference, clearSelection: boolean, apply: (ids: Id64Set) => boolean): boolean {
  const selection = ref.iModel.selectionSet;
  if (!selection.isActive || !apply(selection.elements))
    return false;
  if (clearSelection)
    selection.emptyAll();
  return true;
}

function isActive(ops: EmphasizeOps): boolean {
  return ops.ref.isAlwaysDrawnExclusive || undefined !== ops.defaultAppearance || undefined !== ops.getNeverDrawnElements()
    || undefined !== ops.getAlwaysDrawnElements() || undefined !== ops.getOverriddenElements();
}

function toJSON(ops: EmphasizeOps): EmphasizeElementsProps {
  const props: EmphasizeElementsProps = {};
  const neverDrawn = ops.getNeverDrawnElements();
  if (neverDrawn)
    props.neverDrawn = [...neverDrawn];

  const alwaysDrawn = ops.getAlwaysDrawnElements();
  if (alwaysDrawn)
    props.alwaysDrawn = [...alwaysDrawn];

  if (ops.ref.isAlwaysDrawnExclusive)
    props.isAlwaysDrawnExclusive = true;

  const emphasized = ops.getEmphasizedIsolatedElements();
  if (emphasized)
    props.alwaysDrawnExclusiveEmphasized = [...emphasized];

  const defaultAppearance = ops.defaultAppearance;
  if (defaultAppearance)
    props.defaultAppearance = defaultAppearance;

  if (ops.unanimatedAppearance)
    props.unanimatedAppearance = ops.unanimatedAppearance;

  const overridden = ops.getOverriddenElements();
  if (overridden)
    props.appearanceOverride = [...overridden].map(([key, ids]) => {
      const { color, overrideType } = ops.getOverrideFromKey(key);
      return { color: color.toJSON(), overrideType, ids: [...ids] };
    });

  if (ops.wantEmphasis)
    props.wantEmphasis = true;

  return props;
}

function fromJSON(ops: EmphasizeOps, props: EmphasizeElementsProps, setWantEmphasis: (value: boolean) => void): boolean {
  let changed = false;
  if (props.neverDrawn && ops.setNeverDrawnElements(new Set(props.neverDrawn), true))
    changed = true;
  if ((props.alwaysDrawn || props.isAlwaysDrawnExclusive) && ops.setAlwaysDrawnElements(new RestoredAlwaysDrawnIds(props.alwaysDrawn), true === props.isAlwaysDrawnExclusive))
    changed = true;
  if (props.alwaysDrawnExclusiveEmphasized)
    ops.state.emphasizeIsolated = new Set(props.alwaysDrawnExclusiveEmphasized);
  if (props.defaultAppearance) {
    const appearance = FeatureAppearance.fromJSON(props.defaultAppearance);
    if (!ops.defaultAppearance?.equals(appearance))
      changed = true;
    ops.defaultAppearance = appearance;
  }
  if (props.unanimatedAppearance)
    ops.unanimatedAppearance = FeatureAppearance.fromJSON(props.unanimatedAppearance);
  if (props.appearanceOverride)
    for (const override of props.appearanceOverride)
      if (override.ids && ops.overrideElements(new Set(override.ids), ColorDef.fromJSON(override.color), override.overrideType, true))
        changed = true;
  const wantEmphasis = true === props.wantEmphasis;
  if (wantEmphasis !== ops.wantEmphasis) {
    setWantEmphasis(wantEmphasis);
    changed = true;
  }
  if (changed)
    ops.notifyChanged();
  return changed;
}

/** An implementation of [[FeatureOverrideProvider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 * @public
 * @extensions
 */
export class EmphasizeElements implements FeatureOverrideProvider {
  readonly #state = createState();

  #ops(vp: Viewport): EmphasizeOps {
    // Route shared logic through virtual instance methods so legacy subclasses keep their hooks.
    const self = this;
    return {
      state: this.#state,
      ref: vp.primaryIModelRef,
      get wantEmphasis() { return self.wantEmphasis; },
      get defaultAppearance() { return self.defaultAppearance; },
      set defaultAppearance(value) { self.defaultAppearance = value; },
      get unanimatedAppearance() { return self.unanimatedAppearance; },
      set unanimatedAppearance(value) { self.unanimatedAppearance = value; },
      createDefaultAppearance: () => this.createDefaultAppearance(),
      createAppearanceFromKey: (key) => this.createAppearanceFromKey(key),
      createOverrideKey: (color, override) => this.createOverrideKey(color, override),
      getOverrideFromKey: (key) => this.getOverrideFromKey(key),
      getNeverDrawnElements: () => this.getNeverDrawnElements(vp),
      getAlwaysDrawnElements: () => this.getAlwaysDrawnElements(vp),
      getIsolatedElements: () => this.getIsolatedElements(vp),
      getEmphasizedIsolatedElements: () => this.getEmphasizedIsolatedElements(),
      getEmphasizedElements: () => this.getEmphasizedElements(vp),
      getOverriddenElements: () => this.getOverriddenElements(),
      getOverriddenElementsByKey: (key) => this.getOverriddenElementsByKey(key),
      clearAlwaysDrawnElements: () => this.clearAlwaysDrawnElements(vp),
      clearEmphasizedIsolatedElements: (setToAlwaysDrawn) => this.clearEmphasizedIsolatedElements(vp, setToAlwaysDrawn),
      updateIdSet: (ids, replace, existingIds) => this.updateIdSet(ids, replace, existingIds),
      setNeverDrawnElements: (ids, replace) => this.setNeverDrawnElements(ids, vp, replace),
      setAlwaysDrawnElements: (ids, exclusive, replace) => this.setAlwaysDrawnElements(ids, vp, exclusive, replace),
      overrideElements: (ids, color, override, replace) => this.overrideElements(ids, vp, color, override, replace),
      notifyChanged: () => vp.setFeatureOverrideProviderChanged(),
    };
  }

  public static get defaultAppearance() { return defaultEmphasizeAppearance; }

  /** If true, all overridden and emphasized elements will also have the "emphasis" effect applied to them. This causes them to be hilited using the current [[Viewport.emphasisSettings]]. */
  public get wantEmphasis(): boolean { return this.#state.wantEmphasis; }
  public set wantEmphasis(value: boolean) { this.#state.wantEmphasis = value; }

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides.
   * @see [[Viewport.addFeatureOverrideProvider]]
   */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, vp: Viewport): void {
    addFeatureOverrides(this.#ops(vp), overrides);
  }

  /** @internal */
  public createAppearanceFromKey(key: number): FeatureAppearance {
    return createAppearanceFromKey(this, key);
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
    return createDefaultAppearance();
  }

  /** Get the IDs of the currently never drawn elements. */
  public getNeverDrawnElements(vp: Viewport): Id64Set | undefined {
    const ids = vp.primaryIModelRef.neverDrawnElements;
    return 0 !== ids.size ? ids : undefined;
  }

  /** Get the IDs of the currently always drawn elements. */
  public getAlwaysDrawnElements(vp: Viewport): Id64Set | undefined {
    const ids = vp.primaryIModelRef.alwaysDrawnElements;
    return 0 !== ids.size ? ids : undefined;
  }

  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(vp: Viewport): Id64Set | undefined {
    return this.getNeverDrawnElements(vp);
  }

  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(vp: Viewport): Id64Set | undefined {
    return vp.primaryIModelRef.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements(vp) : undefined;
  }

  /** Get the IDs of the currently emphasized isolated elements. */
  public getEmphasizedIsolatedElements(): Id64Set | undefined {
    return this.defaultAppearance && this.#state.emphasizeIsolated?.size ? this.#state.emphasizeIsolated : undefined;
  }

  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(vp: Viewport): Id64Set | undefined {
    return this.getEmphasizedIsolatedElements() ?? (this.defaultAppearance && !vp.primaryIModelRef.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements(vp) : undefined);
  }

  /** Get the map of current elements with color/transparency overrides. */
  public getOverriddenElements(): Map<number, Id64Set> | undefined {
    return this.#state.overrideAppearance?.size ? this.#state.overrideAppearance : undefined;
  }

  /** Get the IDs of current elements with the specified color/transparency override. */
  public getOverriddenElementsByKey(key: number): Id64Set | undefined {
    return this.#state.overrideAppearance?.get(key);
  }

  /** Clear never drawn elements.
   * @return false if nothing to clear.
   */
  public clearNeverDrawnElements(vp: Viewport): boolean {
    return clearNeverDrawnElements(this.#ops(vp));
  }

  /** Clear always drawn elements.
   * @return false if nothing to clear.
   */
  public clearAlwaysDrawnElements(vp: Viewport): boolean {
    return clearAlwaysDrawnElements(this.#ops(vp));
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
    return clearIsolatedElements(this.#ops(vp));
  }

  /** Clear emphasized elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedElements(vp: Viewport): boolean {
    return clearEmphasizedElements(this.#ops(vp));
  }

  /** Clear emphasized isolated elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedIsolatedElements(vp: Viewport, setToAlwaysDrawn: boolean): boolean {
    return clearEmphasizedIsolatedElements(this.#ops(vp), setToAlwaysDrawn);
  }

  /** Clear color/transparency overrides from elements. Removes all overrides when keyOrIds isn't supplied.
   * @param keyOrIds Specify a key value from [[EmphasizeElements.getOverriddenElements]] or [[EmphasizeElements.createOverrideKey]]
   * to remove a single color/transparency override for the corresponding elements or specify the IDs of elements to
   * remove any color/transparency override from.
   * @return false if nothing to clear.
   */
  public clearOverriddenElements(vp: Viewport, keyOrIds?: number | Id64Arg): boolean {
    return clearOverriddenElements(this.#ops(vp), keyOrIds);
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
    return setNeverDrawnElements(this.#ops(vp), ids, replace);
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
    return setAlwaysDrawnElements(this.#ops(vp), ids, exclusive, replace);
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
    return applyToSelection(vp.primaryIModelRef, clearSelection, (ids) => this.hideElements(ids, vp, replace));
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
    return isolateElements(this.#ops(vp), ids, replace);
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
    return applyToSelection(vp.primaryIModelRef, clearSelection, (ids) => this.isolateElements(ids, vp, replace));
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
    return emphasizeElements(this.#ops(vp), ids, defaultAppearance, replace);
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
    return applyToSelection(vp.primaryIModelRef, clearSelection, (ids) => this.emphasizeElements(ids, vp, defaultAppearance, replace));
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
    return overrideElements(this.#ops(vp), ids, color, override, replace);
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
    return applyToSelection(vp.primaryIModelRef, clearSelection, (ids) => this.overrideElements(ids, vp, color, override, replace));
  }

  /** @return true if provider is currently overriding the display of any elements. */
  public isActive(vp: Viewport): boolean {
    return isActive(this.#ops(vp));
  }

  /** Serialize to JSON representation.
   * @see [[EmphasizeElements.fromJSON]]
   */
  public toJSON(vp: Viewport): EmphasizeElementsProps {
    return toJSON(this.#ops(vp));
  }

  /** Initialize from JSON representation.
   * @see [[EmphasizeElements.toJSON]]
   */
  public fromJSON(props: EmphasizeElementsProps, vp: Viewport): boolean {
    return fromJSON(this.#ops(vp), props, (value) => { this.wantEmphasis = value; });
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

    const ref = vp.primaryIModelRef;
    ref.neverDrawnElements.clear();
    ref.alwaysDrawnElements.clear();
    // Isolation leaves exclusivity enabled; an empty exclusive set would draw no elements at all.
    ref.isAlwaysDrawnExclusive = false;
    vp.dropFeatureOverrideProvider(provider);
  }
}

/** An implementation of [[IModelDisplayReferenceFeatureOverrideProvider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 * @beta
 */
export class EmphasizeIModelElements implements IModelDisplayReferenceFeatureOverrideProvider {
  readonly #iModelRef: IModelDisplayReference;
  readonly #state = createState();
  readonly #ops: EmphasizeOps;

  private constructor(iModelRef: IModelDisplayReference) {
    this.#iModelRef = iModelRef;
    const self = this;
    this.#ops = {
      state: this.#state,
      ref: iModelRef,
      get wantEmphasis() { return self.wantEmphasis; },
      get defaultAppearance() { return self.defaultAppearance; },
      set defaultAppearance(value) { self.defaultAppearance = value; },
      get unanimatedAppearance() { return self.unanimatedAppearance; },
      set unanimatedAppearance(value) { self.unanimatedAppearance = value; },
      createDefaultAppearance: () => this.createDefaultAppearance(),
      createAppearanceFromKey: (key) => this.createAppearanceFromKey(key),
      createOverrideKey: (color, override) => this.createOverrideKey(color, override),
      getOverrideFromKey: (key) => this.getOverrideFromKey(key),
      getNeverDrawnElements: () => this.getNeverDrawnElements(),
      getAlwaysDrawnElements: () => this.getAlwaysDrawnElements(),
      getIsolatedElements: () => this.getIsolatedElements(),
      getEmphasizedIsolatedElements: () => this.getEmphasizedIsolatedElements(),
      getEmphasizedElements: () => this.getEmphasizedElements(),
      getOverriddenElements: () => this.getOverriddenElements(),
      getOverriddenElementsByKey: (key) => this.getOverriddenElementsByKey(key),
      clearAlwaysDrawnElements: () => this.clearAlwaysDrawnElements(),
      clearEmphasizedIsolatedElements: (setToAlwaysDrawn) => this.clearEmphasizedIsolatedElements(setToAlwaysDrawn),
      updateIdSet: (ids, replace, existingIds) => this.updateIdSet(ids, replace, existingIds),
      setNeverDrawnElements: (ids, replace) => this.setNeverDrawnElements(ids, replace),
      setAlwaysDrawnElements: (ids, exclusive, replace) => this.setAlwaysDrawnElements(ids, exclusive, replace),
      overrideElements: (ids, color, override, replace) => this.overrideElements(ids, color, override, replace),
      notifyChanged: () => this.#iModelRef.invalidateSymbologyOverrides(),
    };
  }

  public static get defaultAppearance() { return defaultEmphasizeAppearance; }

  /** If true, all overridden and emphasized elements will also have the "emphasis" effect applied to them. */
  public get wantEmphasis(): boolean { return this.#state.wantEmphasis; }
  public set wantEmphasis(value: boolean) { this.#state.wantEmphasis = value; }

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides. */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides): void {
    addFeatureOverrides(this.#ops, overrides);
  }

  /** @internal */
  public createAppearanceFromKey(key: number): FeatureAppearance {
    return createAppearanceFromKey(this, key);
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
    return createDefaultAppearance();
  }

  /** Get the IDs of the currently never drawn elements. */
  public getNeverDrawnElements(): Id64Set | undefined {
    const ids = this.#iModelRef.neverDrawnElements;
    return 0 !== ids.size ? ids : undefined;
  }

  /** Get the IDs of the currently always drawn elements. */
  public getAlwaysDrawnElements(): Id64Set | undefined {
    const ids = this.#iModelRef.alwaysDrawnElements;
    return 0 !== ids.size ? ids : undefined;
  }

  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(): Id64Set | undefined {
    return this.getNeverDrawnElements();
  }

  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(): Id64Set | undefined {
    return this.#iModelRef.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements() : undefined;
  }

  /** Get the IDs of the currently emphasized isolated elements. */
  public getEmphasizedIsolatedElements(): Id64Set | undefined {
    return this.defaultAppearance && this.#state.emphasizeIsolated?.size ? this.#state.emphasizeIsolated : undefined;
  }

  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(): Id64Set | undefined {
    return this.getEmphasizedIsolatedElements() ?? (this.defaultAppearance && !this.#iModelRef.isAlwaysDrawnExclusive ? this.getAlwaysDrawnElements() : undefined);
  }

  /** Get the map of current elements with color/transparency overrides. */
  public getOverriddenElements(): Map<number, Id64Set> | undefined {
    return this.#state.overrideAppearance?.size ? this.#state.overrideAppearance : undefined;
  }

  /** Get the IDs of current elements with the specified color/transparency override. */
  public getOverriddenElementsByKey(key: number): Id64Set | undefined {
    return this.#state.overrideAppearance?.get(key);
  }

  /** Clear never drawn elements. */
  public clearNeverDrawnElements(): boolean {
    return clearNeverDrawnElements(this.#ops);
  }

  /** Clear always drawn elements. */
  public clearAlwaysDrawnElements(): boolean {
    return clearAlwaysDrawnElements(this.#ops);
  }

  /** Clear hidden elements. */
  public clearHiddenElements(): boolean {
    return this.clearNeverDrawnElements();
  }

  /** Clear isolated elements. */
  public clearIsolatedElements(): boolean {
    return clearIsolatedElements(this.#ops);
  }

  /** Clear emphasized elements. */
  public clearEmphasizedElements(): boolean {
    return clearEmphasizedElements(this.#ops);
  }

  /** Clear emphasized isolated elements. */
  public clearEmphasizedIsolatedElements(setToAlwaysDrawn: boolean): boolean {
    return clearEmphasizedIsolatedElements(this.#ops, setToAlwaysDrawn);
  }

  /** Clear color/transparency overrides from elements. */
  public clearOverriddenElements(keyOrIds?: number | Id64Arg): boolean {
    return clearOverriddenElements(this.#ops, keyOrIds);
  }

  /** @internal */
  public updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined {
    return updateIdSet(ids, replace, existingIds);
  }

  /** Set the element IDs to be never drawn. */
  public setNeverDrawnElements(ids: Id64Arg, replace: boolean = true): boolean {
    return setNeverDrawnElements(this.#ops, ids, replace);
  }

  /** Set the element IDs to be always drawn. */
  public setAlwaysDrawnElements(ids: Id64Arg, exclusive: boolean = true, replace: boolean = true): boolean {
    return setAlwaysDrawnElements(this.#ops, ids, exclusive, replace);
  }

  /** Set the element IDs to be never drawn. */
  public hideElements(ids: Id64Arg, replace: boolean = false): boolean {
    return this.setNeverDrawnElements(ids, replace);
  }

  /** Set the element IDs to be always drawn exclusively. */
  public isolateElements(ids: Id64Arg, replace: boolean = true): boolean {
    return isolateElements(this.#ops, ids, replace);
  }

  /** Set the element IDs to be always drawn normally with all other elements in the view overridden to draw using a default appearance. */
  public emphasizeElements(ids: Id64Arg, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
    return emphasizeElements(this.#ops, ids, defaultAppearance, replace);
  }

  /** Set the element IDs to display with a color/transparency override. */
  public overrideElements(ids: Id64Arg, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
    return overrideElements(this.#ops, ids, color, override, replace);
  }

  /** Set the currently selected elements to be always drawn exclusively. */
  public isolateSelectedElements(ref: IModelDisplayReference, replace: boolean = true, clearSelection: boolean = true): boolean {
    return applyToSelection(ref, clearSelection, (ids) => this.isolateElements(ids, replace));
  }

  /** Set the currently selected elements to be always drawn normally with all other elements in the view overridden to draw using a default appearance. */
  public emphasizeSelectedElements(ref: IModelDisplayReference, defaultAppearance?: FeatureAppearance, replace: boolean = true, clearSelection: boolean = true): boolean {
    return applyToSelection(ref, clearSelection, (ids) => this.emphasizeElements(ids, defaultAppearance, replace));
  }

  /** Set the currently selected elements to display with a color/transparency override. */
  public overrideSelectedElements(ref: IModelDisplayReference, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false, clearSelection: boolean = true): boolean {
    return applyToSelection(ref, clearSelection, (ids) => this.overrideElements(ids, color, override, replace));
  }

  /** @return true if provider is currently overriding the display of any elements. */
  public get isActive(): boolean {
    return isActive(this.#ops);
  }

  /** Serialize to JSON representation. */
  public toJSON(): EmphasizeElementsProps {
    return toJSON(this.#ops);
  }

  /** Initialize from JSON representation. */
  public fromJSON(props: EmphasizeElementsProps): boolean {
    return fromJSON(this.#ops, props, (value) => { this.wantEmphasis = value; });
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
    // Isolation leaves exclusivity enabled; an empty exclusive set would draw no elements at all.
    ref.isAlwaysDrawnExclusive = false;
    ref.featureOverrideProviders.delete(provider);
  }
}
