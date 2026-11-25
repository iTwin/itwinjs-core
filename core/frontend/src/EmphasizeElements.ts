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

/** Shared hook surface satisfied directly by both EmphasizeElements (C = Viewport) and EmphasizeIModelElements (C = IModelDisplayReference). */
interface EmphasizeHost<C> {
  wantEmphasis: boolean;
  defaultAppearance: FeatureAppearance | undefined;
  unanimatedAppearance: FeatureAppearance | undefined;
  createDefaultAppearance(): FeatureAppearance;
  createAppearanceFromKey(key: number): FeatureAppearance;
  createOverrideKey(color: ColorDef, override: FeatureOverrideType): number | undefined;
  getOverrideFromKey(key: number): { overrideType: FeatureOverrideType, color: ColorDef };
  getNeverDrawnElements(ctx: C): Id64Set | undefined;
  getAlwaysDrawnElements(ctx: C): Id64Set | undefined;
  getEmphasizedIsolatedElements(): Id64Set | undefined;
  getOverriddenElements(): Map<number, Id64Set> | undefined;
  getOverriddenElementsByKey(key: number): Id64Set | undefined;
  clearAlwaysDrawnElements(ctx: C): boolean;
  updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined;
}

/** Module-static adapter for the few operations whose target or parameter order differs between Viewport and IModelDisplayReference. */
interface EmphasizeAdapter<H extends EmphasizeHost<C>, C> {
  getRef(ctx: C): IModelDisplayReference;
  getIsolatedElements(host: H, ctx: C): Id64Set | undefined;
  getEmphasizedElements(host: H, ctx: C, state: EmphasizeElementsState): Id64Set | undefined;
  clearEmphasizedIsolatedElements(host: H, ctx: C, setToAlwaysDrawn: boolean): boolean;
  setNeverDrawnElements(host: H, ctx: C, ids: Id64Arg, replace?: boolean): boolean;
  setAlwaysDrawnElements(host: H, ctx: C, ids: Id64Arg, exclusive?: boolean, replace?: boolean): boolean;
  overrideElements(host: H, ctx: C, state: EmphasizeElementsState, ids: Id64Arg, color: ColorDef, override?: FeatureOverrideType, replace?: boolean): boolean;
  notifyChanged(ctx: C): void;
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

function createAppearanceFromKey(host: Pick<EmphasizeHost<never>, "getOverrideFromKey" | "wantEmphasis">, key: number): FeatureAppearance {
  const { color, overrideType } = host.getOverrideFromKey(key);
  return FeatureAppearance.fromJSON({
    rgb: overrideType === FeatureOverrideType.AlphaOnly ? undefined : RgbColor.fromColorDef(color),
    transparency: overrideType === FeatureOverrideType.ColorOnly ? undefined : color.getTransparency() / 255,
    emphasized: host.wantEmphasis || undefined,
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

function getRefAlwaysDrawn(ref: IModelDisplayReference): Id64Set | undefined {
  return 0 !== ref.alwaysDrawnElements.size ? ref.alwaysDrawnElements : undefined;
}

function getRefIsolated(ref: IModelDisplayReference): Id64Set | undefined {
  return ref.isAlwaysDrawnExclusive ? getRefAlwaysDrawn(ref) : undefined;
}

function getRefEmphasized(ref: IModelDisplayReference, state: EmphasizeElementsState): Id64Set | undefined {
  return (state.defaultAppearance && state.emphasizeIsolated?.size ? state.emphasizeIsolated : undefined)
    ?? (state.defaultAppearance && !ref.isAlwaysDrawnExclusive ? getRefAlwaysDrawn(ref) : undefined);
}

/** Run a visibility mutation and invalidate once if the reference did not already raise an invalidation event (e.g., ForeignIModelRef or custom updateIdSet). */
function ensureInvalidated(ref: IModelDisplayReference, mutate: () => void): void {
  let invalidated = false;
  const remove = ref.onSymbologyOverridesInvalidated.addListener(() => { invalidated = true; });
  try {
    mutate();
  } finally {
    remove();
  }
  if (!invalidated)
    ref.invalidateSymbologyOverrides();
}

function addFeatureOverrides<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, overrides: FeatureSymbology.Overrides): void {
  const defaultAppearance = host.defaultAppearance;
  if (defaultAppearance)
    overrides.setDefaultOverrides(defaultAppearance);

  const emphasized = adapter.getEmphasizedElements(host, ctx, state);
  if (emphasized) {
    const appearance = host.wantEmphasis ? state.emphasizedAppearance : FeatureAppearance.defaults;
    const args = { elementId: "", appearance };
    for (const elementId of emphasized) {
      args.elementId = elementId;
      overrides.override(args);
    }

    overrides[_ignoreAnimationOverridesExcept](emphasized);
  }

  const overridden = host.getOverriddenElements();
  if (overridden) {
    const args = { elementId: "", appearance: FeatureAppearance.defaults };
    for (const [key, ids] of overridden) {
      args.appearance = host.createAppearanceFromKey(key);
      for (const elementId of ids) {
        args.elementId = elementId;
        overrides.override(args);
      }
    }
  }

  const unanimated = host.unanimatedAppearance;
  if (unanimated) {
    if (unanimated.isFullyTransparent)
      overrides.neverDrawnAnimationNodes.add(0);
    else
      overrides.animationNodeOverrides.set(0, unanimated);
  }
}

function clearNeverDrawnElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, ref: IModelDisplayReference): boolean {
  if (undefined === host.getNeverDrawnElements(ctx))
    return false;

  ensureInvalidated(ref, () => ref.neverDrawnElements.clear());
  return true;
}

function clearAlwaysDrawnElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, ref: IModelDisplayReference): boolean {
  if (!ref.isAlwaysDrawnExclusive && undefined === host.getAlwaysDrawnElements(ctx))
    return false;

  ensureInvalidated(ref, () => {
    ref.alwaysDrawnElements.clear();
    ref.isAlwaysDrawnExclusive = false;
  });
  return true;
}

function clearIsolatedElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, adapter: EmphasizeAdapter<H, C>): boolean {
  const ref = adapter.getRef(ctx);
  if (undefined === adapter.getIsolatedElements(host, ctx) && !(ref.isAlwaysDrawnExclusive && !ref.alwaysDrawnElements.size))
    return false;

  return adapter.clearEmphasizedIsolatedElements(host, ctx, true) || host.clearAlwaysDrawnElements(ctx);
}

function clearEmphasizedElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>): boolean {
  if (undefined === adapter.getEmphasizedElements(host, ctx, state))
    return false;

  if (adapter.clearEmphasizedIsolatedElements(host, ctx, false))
    return true;

  if (!host.clearAlwaysDrawnElements(ctx))
    return false;

  host.defaultAppearance = undefined;
  adapter.notifyChanged(ctx);
  return true;
}

function clearEmphasizedIsolatedElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, setToAlwaysDrawn: boolean): boolean {
  const emphasized = host.getEmphasizedIsolatedElements();
  state.emphasizeIsolated = undefined;
  if (undefined === emphasized)
    return false;

  if (!setToAlwaysDrawn || !adapter.setAlwaysDrawnElements(host, ctx, emphasized, false))
    host.defaultAppearance = undefined;
  adapter.notifyChanged(ctx);
  return true;
}

function clearOverriddenElements<H extends EmphasizeHost<C>, C>(ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, keyOrIds?: number | Id64Arg): boolean {
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

  adapter.notifyChanged(ctx);
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
  ensureInvalidated(ref, () => {
    ref.alwaysDrawnElements.clear();
    ref.isAlwaysDrawnExclusive = true;
  });
  return true;
}

function setNeverDrawnElements<H extends EmphasizeHost<C>, C>(host: H, ref: IModelDisplayReference, ids: Id64Arg, replace: boolean = true): boolean {
  const target = ref.neverDrawnElements;
  const hidden = host.updateIdSet(ids, replace, target);
  if (undefined === hidden)
    return false;

  ensureInvalidated(ref, () => {
    if (hidden !== target) {
      target.clear();
      target.addAll(hidden);
    }
  });
  return true;
}

function setAlwaysDrawnElements<H extends EmphasizeHost<C>, C>(host: H, ref: IModelDisplayReference, ids: Id64Arg, exclusive: boolean = true, replace: boolean = true): boolean {
  if (replace && exclusive && ids instanceof RestoredAlwaysDrawnIds && !ids.size)
    return setEmptyExclusive(ref);

  const target = ref.alwaysDrawnElements;
  const visible = host.updateIdSet(ids, replace, target);
  if (undefined === visible)
    return false;

  ensureInvalidated(ref, () => {
    if (visible !== target) {
      target.clear();
      target.addAll(visible);
    }
    ref.isAlwaysDrawnExclusive = exclusive;
  });
  return true;
}

function isolateElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, ids: Id64Arg, replace: boolean = true): boolean {
  const wasEmphasized = undefined !== adapter.getEmphasizedElements(host, ctx, state);
  if (!adapter.setAlwaysDrawnElements(host, ctx, ids, true, replace))
    return false;

  if (wasEmphasized) {
    host.defaultAppearance = undefined;
    state.emphasizeIsolated = undefined;
  }

  return true;
}

function emphasizeElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, ids: Id64Arg, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
  if (undefined !== adapter.getIsolatedElements(host, ctx)) {
    const emphasized = host.updateIdSet(ids, replace, state.emphasizeIsolated);
    if (undefined === emphasized)
      return false;

    state.emphasizeIsolated = emphasized;
  } else {
    if (!adapter.setAlwaysDrawnElements(host, ctx, ids, false, replace))
      return false;

    state.emphasizeIsolated = undefined;
  }

  host.defaultAppearance = defaultAppearance ?? host.createDefaultAppearance();
  adapter.notifyChanged(ctx);
  return true;
}

function overrideElements<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, ids: Id64Arg, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
  const key = host.createOverrideKey(color, override);
  if (undefined === key)
    return false;
  const requestedIds = Id64.toIdSet(ids, true);
  if (0 === requestedIds.size)
    return false;

  const existingIds = replace ? undefined : host.getOverriddenElementsByKey(key);
  const overrideIds = new Set(requestedIds);
  const oldSize = existingIds?.size ?? 0;
  if (existingIds)
    for (const id of existingIds)
      overrideIds.add(id);
  if (oldSize === overrideIds.size)
    return false;

  state.overrideAppearance ??= new Map<number, Id64Set>();
  for (const [otherKey, otherIds] of state.overrideAppearance) {
    if (otherKey === key)
      continue;
    for (const id of requestedIds)
      otherIds.delete(id);
    if (0 === otherIds.size)
      state.overrideAppearance.delete(otherKey);
  }
  state.overrideAppearance.set(key, overrideIds);
  adapter.notifyChanged(ctx);
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

function toJSON<H extends EmphasizeHost<C>, C>(host: H, ctx: C, adapter: EmphasizeAdapter<H, C>): EmphasizeElementsProps {
  const props: EmphasizeElementsProps = {};
  const neverDrawn = host.getNeverDrawnElements(ctx);
  if (neverDrawn)
    props.neverDrawn = [...neverDrawn];

  const alwaysDrawn = host.getAlwaysDrawnElements(ctx);
  if (alwaysDrawn)
    props.alwaysDrawn = [...alwaysDrawn];

  if (adapter.getRef(ctx).isAlwaysDrawnExclusive)
    props.isAlwaysDrawnExclusive = true;

  const emphasized = host.getEmphasizedIsolatedElements();
  if (emphasized)
    props.alwaysDrawnExclusiveEmphasized = [...emphasized];

  const defaultAppearance = host.defaultAppearance;
  if (defaultAppearance)
    props.defaultAppearance = defaultAppearance;

  if (host.unanimatedAppearance)
    props.unanimatedAppearance = host.unanimatedAppearance;

  const overridden = host.getOverriddenElements();
  if (overridden)
    props.appearanceOverride = [...overridden].map(([key, ids]) => {
      const { color, overrideType } = host.getOverrideFromKey(key);
      return { color: color.toJSON(), overrideType, ids: [...ids] };
    });

  if (host.wantEmphasis)
    props.wantEmphasis = true;

  return props;
}

function fromJSON<H extends EmphasizeHost<C>, C>(host: H, ctx: C, state: EmphasizeElementsState, adapter: EmphasizeAdapter<H, C>, props: EmphasizeElementsProps): boolean {
  let changed = false;
  if (props.neverDrawn && adapter.setNeverDrawnElements(host, ctx, new Set(props.neverDrawn), true))
    changed = true;
  if ((props.alwaysDrawn || props.isAlwaysDrawnExclusive) && adapter.setAlwaysDrawnElements(host, ctx, new RestoredAlwaysDrawnIds(props.alwaysDrawn), true === props.isAlwaysDrawnExclusive))
    changed = true;
  if (props.alwaysDrawnExclusiveEmphasized)
    state.emphasizeIsolated = new Set(props.alwaysDrawnExclusiveEmphasized);
  if (props.defaultAppearance) {
    const appearance = FeatureAppearance.fromJSON(props.defaultAppearance);
    if (!host.defaultAppearance?.equals(appearance))
      changed = true;
    host.defaultAppearance = appearance;
  }
  if (props.unanimatedAppearance)
    host.unanimatedAppearance = FeatureAppearance.fromJSON(props.unanimatedAppearance);
  if (props.appearanceOverride)
    for (const override of props.appearanceOverride)
      if (override.ids && adapter.overrideElements(host, ctx, state, new Set(override.ids), ColorDef.fromJSON(override.color), override.overrideType, true))
        changed = true;
  const wantEmphasis = true === props.wantEmphasis;
  if (wantEmphasis !== host.wantEmphasis) {
    host.wantEmphasis = wantEmphasis;
    changed = true;
  }
  if (changed)
    adapter.notifyChanged(ctx);
  return changed;
}

// Route EmphasizeElements through virtual instance methods so legacy subclasses keep their hooks.
const viewportAdapter: EmphasizeAdapter<EmphasizeElements, Viewport> = {
  getRef: (vp) => vp.primaryIModelRef,
  getIsolatedElements: (host, vp) => host.getIsolatedElements(vp),
  getEmphasizedElements: (host, vp) => host.getEmphasizedElements(vp),
  clearEmphasizedIsolatedElements: (host, vp, setToAlwaysDrawn) => host.clearEmphasizedIsolatedElements(vp, setToAlwaysDrawn),
  setNeverDrawnElements: (host, vp, ids, replace) => host.setNeverDrawnElements(ids, vp, replace),
  setAlwaysDrawnElements: (host, vp, ids, exclusive, replace) => host.setAlwaysDrawnElements(ids, vp, exclusive, replace),
  overrideElements: (host, vp, _state, ids, color, override, replace) => host.overrideElements(ids, vp, color, override, replace),
  notifyChanged: (vp) => vp.setFeatureOverrideProviderChanged(),
};

// EmphasizeIModelElements has a private constructor and may operate on an explicit ref passed to *SelectedElements.
const refAdapter: EmphasizeAdapter<EmphasizeIModelElements, IModelDisplayReference> = {
  getRef: (ref) => ref,
  getIsolatedElements: (_host, ref) => getRefIsolated(ref),
  getEmphasizedElements: (_host, ref, state) => getRefEmphasized(ref, state),
  clearEmphasizedIsolatedElements: (host, _ref, setToAlwaysDrawn) => host.clearEmphasizedIsolatedElements(setToAlwaysDrawn),
  setNeverDrawnElements: (host, ref, ids, replace) => setNeverDrawnElements(host, ref, ids, replace),
  setAlwaysDrawnElements: (host, ref, ids, exclusive, replace) => setAlwaysDrawnElements(host, ref, ids, exclusive, replace),
  overrideElements: (host, ref, state, ids, color, override, replace) => overrideElements(host, ref, state, refAdapter, ids, color, override, replace),
  notifyChanged: (ref) => ref.invalidateSymbologyOverrides(),
};

/** An implementation of [[FeatureOverrideProvider]] for emphasizing selected elements through simple color/transparency appearance overrides.
 * @public
 * @extensions
 */
export class EmphasizeElements implements FeatureOverrideProvider {
  readonly #state = createState();

  public static get defaultAppearance() { return defaultEmphasizeAppearance; }

  /** If true, all overridden and emphasized elements will also have the "emphasis" effect applied to them. This causes them to be hilited using the current [[Viewport.emphasisSettings]]. */
  public get wantEmphasis(): boolean { return this.#state.wantEmphasis; }
  public set wantEmphasis(value: boolean) { this.#state.wantEmphasis = value; }

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides.
   * @see [[Viewport.addFeatureOverrideProvider]]
   */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides, vp: Viewport): void {
    addFeatureOverrides(this, vp, this.#state, viewportAdapter, overrides);
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
    return getRefAlwaysDrawn(vp.primaryIModelRef);
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
    return clearNeverDrawnElements(this, vp, vp.primaryIModelRef);
  }

  /** Clear always drawn elements.
   * @return false if nothing to clear.
   */
  public clearAlwaysDrawnElements(vp: Viewport): boolean {
    return clearAlwaysDrawnElements(this, vp, vp.primaryIModelRef);
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
    return clearIsolatedElements(this, vp, viewportAdapter);
  }

  /** Clear emphasized elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedElements(vp: Viewport): boolean {
    return clearEmphasizedElements(this, vp, this.#state, viewportAdapter);
  }

  /** Clear emphasized isolated elements.
   * @return false if nothing to clear.
   */
  public clearEmphasizedIsolatedElements(vp: Viewport, setToAlwaysDrawn: boolean): boolean {
    return clearEmphasizedIsolatedElements(this, vp, this.#state, viewportAdapter, setToAlwaysDrawn);
  }

  /** Clear color/transparency overrides from elements. Removes all overrides when keyOrIds isn't supplied.
   * @param keyOrIds Specify a key value from [[EmphasizeElements.getOverriddenElements]] or [[EmphasizeElements.createOverrideKey]]
   * to remove a single color/transparency override for the corresponding elements or specify the IDs of elements to
   * remove any color/transparency override from.
   * @return false if nothing to clear.
   */
  public clearOverriddenElements(vp: Viewport, keyOrIds?: number | Id64Arg): boolean {
    return clearOverriddenElements(vp, this.#state, viewportAdapter, keyOrIds);
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
    return setNeverDrawnElements(this, vp.primaryIModelRef, ids, replace);
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
    return setAlwaysDrawnElements(this, vp.primaryIModelRef, ids, exclusive, replace);
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
    return isolateElements(this, vp, this.#state, viewportAdapter, ids, replace);
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
    return emphasizeElements(this, vp, this.#state, viewportAdapter, ids, defaultAppearance, replace);
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
    return overrideElements(this, vp, this.#state, viewportAdapter, ids, color, override, replace);
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
    return vp.primaryIModelRef.isAlwaysDrawnExclusive || undefined !== this.defaultAppearance || undefined !== this.getNeverDrawnElements(vp)
      || undefined !== this.getAlwaysDrawnElements(vp) || undefined !== this.getOverriddenElements();
  }

  /** Serialize to JSON representation.
   * @see [[EmphasizeElements.fromJSON]]
   */
  public toJSON(vp: Viewport): EmphasizeElementsProps {
    return toJSON(this, vp, viewportAdapter);
  }

  /** Initialize from JSON representation.
   * @see [[EmphasizeElements.toJSON]]
   */
  public fromJSON(props: EmphasizeElementsProps, vp: Viewport): boolean {
    return fromJSON(this, vp, this.#state, viewportAdapter, props);
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

  private constructor(iModelRef: IModelDisplayReference) {
    this.#iModelRef = iModelRef;
  }

  public static get defaultAppearance() { return defaultEmphasizeAppearance; }

  /** If true, all overridden and emphasized elements will also have the "emphasis" effect applied to them. */
  public get wantEmphasis(): boolean { return this.#state.wantEmphasis; }
  public set wantEmphasis(value: boolean) { this.#state.wantEmphasis = value; }

  /** Establish active feature overrides to emphasize elements and apply color/transparency overrides. */
  public addFeatureOverrides(overrides: FeatureSymbology.Overrides): void {
    addFeatureOverrides(this, this.#iModelRef, this.#state, refAdapter, overrides);
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
    return getRefAlwaysDrawn(this.#iModelRef);
  }

  /** Get the IDs of the currently hidden elements. */
  public getHiddenElements(): Id64Set | undefined {
    return this.getNeverDrawnElements();
  }

  /** Get the IDs of the currently isolated elements. */
  public getIsolatedElements(): Id64Set | undefined {
    return getRefIsolated(this.#iModelRef);
  }

  /** Get the IDs of the currently emphasized isolated elements. */
  public getEmphasizedIsolatedElements(): Id64Set | undefined {
    return this.defaultAppearance && this.#state.emphasizeIsolated?.size ? this.#state.emphasizeIsolated : undefined;
  }

  /** Get the IDs of the currently emphasized elements. */
  public getEmphasizedElements(): Id64Set | undefined {
    return getRefEmphasized(this.#iModelRef, this.#state);
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
    return clearNeverDrawnElements(this, this.#iModelRef, this.#iModelRef);
  }

  /** Clear always drawn elements. */
  public clearAlwaysDrawnElements(): boolean {
    return clearAlwaysDrawnElements(this, this.#iModelRef, this.#iModelRef);
  }

  /** Clear hidden elements. */
  public clearHiddenElements(): boolean {
    return this.clearNeverDrawnElements();
  }

  /** Clear isolated elements. */
  public clearIsolatedElements(): boolean {
    return clearIsolatedElements(this, this.#iModelRef, refAdapter);
  }

  /** Clear emphasized elements. */
  public clearEmphasizedElements(): boolean {
    return clearEmphasizedElements(this, this.#iModelRef, this.#state, refAdapter);
  }

  /** Clear emphasized isolated elements. */
  public clearEmphasizedIsolatedElements(setToAlwaysDrawn: boolean): boolean {
    return clearEmphasizedIsolatedElements(this, this.#iModelRef, this.#state, refAdapter, setToAlwaysDrawn);
  }

  /** Clear color/transparency overrides from elements. */
  public clearOverriddenElements(keyOrIds?: number | Id64Arg): boolean {
    return clearOverriddenElements(this.#iModelRef, this.#state, refAdapter, keyOrIds);
  }

  /** @internal */
  public updateIdSet(ids: Id64Arg, replace: boolean, existingIds?: Id64Set): Id64Set | undefined {
    return updateIdSet(ids, replace, existingIds);
  }

  /** Set the element IDs to be never drawn. */
  public setNeverDrawnElements(ids: Id64Arg, replace: boolean = true): boolean {
    return setNeverDrawnElements(this, this.#iModelRef, ids, replace);
  }

  /** Set the element IDs to be always drawn. */
  public setAlwaysDrawnElements(ids: Id64Arg, exclusive: boolean = true, replace: boolean = true): boolean {
    return setAlwaysDrawnElements(this, this.#iModelRef, ids, exclusive, replace);
  }

  /** Set the element IDs to be never drawn. */
  public hideElements(ids: Id64Arg, replace: boolean = false): boolean {
    return this.setNeverDrawnElements(ids, replace);
  }

  /** Set the element IDs to be always drawn exclusively. */
  public isolateElements(ids: Id64Arg, replace: boolean = true): boolean {
    return isolateElements(this, this.#iModelRef, this.#state, refAdapter, ids, replace);
  }

  /** Set the element IDs to be always drawn normally with all other elements in the view overridden to draw using a default appearance. */
  public emphasizeElements(ids: Id64Arg, defaultAppearance?: FeatureAppearance, replace: boolean = true): boolean {
    return emphasizeElements(this, this.#iModelRef, this.#state, refAdapter, ids, defaultAppearance, replace);
  }

  /** Set the element IDs to display with a color/transparency override. */
  public overrideElements(ids: Id64Arg, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false): boolean {
    return overrideElements(this, this.#iModelRef, this.#state, refAdapter, ids, color, override, replace);
  }

  /** Set the currently selected elements to be always drawn exclusively. */
  public isolateSelectedElements(ref: IModelDisplayReference, replace: boolean = true, clearSelection: boolean = true): boolean {
    return applyToSelection(ref, clearSelection, (ids) => isolateElements(this, ref, this.#state, refAdapter, ids, replace));
  }

  /** Set the currently selected elements to be always drawn normally with all other elements in the view overridden to draw using a default appearance. */
  public emphasizeSelectedElements(ref: IModelDisplayReference, defaultAppearance?: FeatureAppearance, replace: boolean = true, clearSelection: boolean = true): boolean {
    return applyToSelection(ref, clearSelection, (ids) => emphasizeElements(this, ref, this.#state, refAdapter, ids, defaultAppearance, replace));
  }

  /** Set the currently selected elements to display with a color/transparency override. */
  public overrideSelectedElements(ref: IModelDisplayReference, color: ColorDef, override: FeatureOverrideType = FeatureOverrideType.ColorOnly, replace: boolean = false, clearSelection: boolean = true): boolean {
    return applyToSelection(ref, clearSelection, (ids) => overrideElements(this, ref, this.#state, refAdapter, ids, color, override, replace));
  }

  /** @return true if provider is currently overriding the display of any elements. */
  public get isActive(): boolean {
    return this.#iModelRef.isAlwaysDrawnExclusive || undefined !== this.defaultAppearance || undefined !== this.getNeverDrawnElements()
      || undefined !== this.getAlwaysDrawnElements() || undefined !== this.getOverriddenElements();
  }

  /** Serialize to JSON representation. */
  public toJSON(): EmphasizeElementsProps {
    return toJSON(this, this.#iModelRef, refAdapter);
  }

  /** Initialize from JSON representation. */
  public fromJSON(props: EmphasizeElementsProps): boolean {
    return fromJSON(this, this.#iModelRef, this.#state, refAdapter, props);
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
