/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, Guid, Id64String, ObservableMap, ObservableSet } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { FeatureAppearance, SubCategoryAppearance, SubCategoryOverride } from "@itwin/core-common";
import { _attachToViewport, _backingView, _detachFromViewport, _implementationProhibited, _scheduleScriptReference } from "../common/internal/Symbols";
import { ChangeCategoryDisplayArgs, IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { IModelDisplayReferences } from "../IModelDisplayReferences";
import { IModelConnection } from "../IModelConnection";
import { IModelDisplayReferenceFeatureOverrideProvider } from "../FeatureOverrideProvider";
import { PerModelCategoryVisibility } from "../PerModelCategoryVisibility";
import { createIModelDisplayOverrides } from "./IModelDisplayOverridesImpl";
import { FeatureSymbology } from "../render/FeatureSymbology";
import { ModelDisplayTransformProvider } from "../ViewState";
import type { TileTreeReference } from "../tile/internal";
import { getSubCategoryAppearance, isSubCategoryVisible } from "./IModelDisplayReferenceImpl";

/** A minimal [[IModelDisplayReference]] identifying an [[IModelConnection]] whose graphics are displayed in a viewport
 * without being part of the view - chiefly, tiles supplied by a [[TiledGraphicsProvider]] whose tile trees originate
 * from an iModel other than the view's own and that has not been linked into the view. It exists solely to attribute
 * those graphics - and the hits they produce - to their own iModel so that picking, snapping, tooltips, and hilite
 * use the correct IModelConnection. It does not affect what is displayed: the graphics are styled by the viewport as
 * on previous versions, so its display-related state is inert.
 */
class ForeignIModelRef implements IModelDisplayReference {
  public readonly [_implementationProhibited] = undefined;

  #symbologyOverrides?: FeatureSymbology.Overrides;
  #modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  #alwaysDrawnExclusive = false;

  public readonly guid = Guid.createValue();
  public readonly iModel: IModelConnection;
  public readonly parent: IModelDisplayReferences;
  public readonly linearTransformToParent: Transform;

  public readonly viewedCategories = new ObservableSet<Id64String>();
  public readonly onViewedCategoriesLoaded = new BeEvent<() => void>();

  public readonly subCategoryOverrides = new ObservableMap<Id64String, SubCategoryOverride>();
  public readonly modelAppearanceOverrides = new ObservableMap<Id64String, FeatureAppearance>();

  public readonly perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;

  public readonly neverDrawnElements = new ObservableSet<Id64String>();
  public readonly alwaysDrawnElements = new ObservableSet<Id64String>();
  public readonly onIsAlwaysDrawnExclusiveChanged = new BeEvent<() => void>();

  public readonly featureOverrideProviders = new ObservableSet<IModelDisplayReferenceFeatureOverrideProvider>();
  public readonly onSymbologyOverridesInvalidated = new BeEvent<() => void>();

  public readonly onModelDisplayTransformProviderChanged = new BeEvent<() => void>();

  public readonly [_scheduleScriptReference] = undefined;

  public readonly overrides = createIModelDisplayOverrides();
  public readonly onActiveClipStyleChanged = new BeEvent<() => void>();
  public readonly onActiveViewFlagsChanged = new BeEvent<() => void>();

  public constructor(refs: IModelDisplayReferences, iModel: IModelConnection, transformToParent?: Transform) {
    this.parent = refs;
    this.iModel = iModel;
    this.linearTransformToParent = transformToParent ?? Transform.identity;
    this.perModelCategoryVisibility = PerModelCategoryVisibility.Overrides.create({
      iModel,
      queue: refs.subcategories,
    });
  }

  public isSpatial(): this is SpatialIModelDisplayReference { return false; }
  public is2d(): this is IModelDisplayReference2d { return false; }

  public get isLoadingComplete(): boolean { return true; }
  public get tileTreeRefs(): Iterable<TileTreeReference> { return []; }

  public get isAlwaysDrawnExclusive(): boolean { return this.#alwaysDrawnExclusive; }
  public set isAlwaysDrawnExclusive(exclusive: boolean) {
    if (exclusive !== this.#alwaysDrawnExclusive) {
      this.#alwaysDrawnExclusive = exclusive;
      this.onIsAlwaysDrawnExclusiveChanged.raiseEvent();
    }
  }

  public getSymbologyOverrides(): FeatureSymbology.Overrides {
    // Graphics attributed to this reference are not drawn through it - they inherit the viewport's symbology overrides.
    return this.#symbologyOverrides ??= new FeatureSymbology.Overrides();
  }

  public invalidateSymbologyOverrides(): void {
    this.#symbologyOverrides = undefined;
    this.onSymbologyOverridesInvalidated.raiseEvent();
  }

  public get modelDisplayTransformProvider(): ModelDisplayTransformProvider | undefined {
    return this.#modelDisplayTransformProvider;
  }

  public set modelDisplayTransformProvider(provider: ModelDisplayTransformProvider | undefined) {
    if (provider !== this.#modelDisplayTransformProvider) {
      this.#modelDisplayTransformProvider = provider;
      this.onModelDisplayTransformProviderChanged.raiseEvent();
    }
  }

  public get activeClipStyle() {
    return this.parent[_backingView].displayStyle.settings.clipStyle;
  }

  public get activeViewFlags() {
    return this.parent[_backingView].viewFlags;
  }

  public [_attachToViewport](): void { }
  public [_detachFromViewport](): void { }

  public changeCategoryDisplay(_args: ChangeCategoryDisplayArgs): void { }

  public isSubCategoryVisible(id: Id64String): boolean {
    return isSubCategoryVisible(this, id);
  }

  public changeSubCategoryDisplay(_id: Id64String, _visible: boolean): boolean { return false; }

  public getSubCategoryAppearance(id: Id64String): SubCategoryAppearance {
    return getSubCategoryAppearance(this, id);
  }
}

interface ForeignRefEntry {
  /** The reference used when no explicit transform is supplied - its linearTransformToParent is the identity. */
  default?: IModelDisplayReference;
  /** References carrying an explicit transform to the view's primary iModel, keyed by the Transform instance so that
   * a persistent graphic branch (which holds a stable Transform instance) resolves to the same reference every frame.
   */
  byTransform?: WeakMap<Transform, IModelDisplayReference>;
}

const foreignRefs = new WeakMap<IModelDisplayReferences, Map<IModelConnection, ForeignRefEntry>>();

/** Obtain the [[IModelDisplayReference]] identifying graphics originating from `iModel` when displayed in the view
 * owning `refs` without being part of the view - e.g., by a [[TiledGraphicsProvider]] whose tile trees come from a
 * different, non-linked IModelConnection. The same reference is returned for the same view, iModel, and transform so
 * that attribution (and feature comparison by reference guid) remains stable across frames.
 */
export function getForeignIModelDisplayReference(refs: IModelDisplayReferences, iModel: IModelConnection, transformToParent?: Transform): IModelDisplayReference {
  let map = foreignRefs.get(refs);
  if (!map)
    foreignRefs.set(refs, map = new Map());

  let entry = map.get(iModel);
  if (!entry)
    map.set(iModel, entry = {});

  if (!transformToParent)
    return entry.default ??= new ForeignIModelRef(refs, iModel);

  const byTransform = entry.byTransform ??= new WeakMap();
  let ref = byTransform.get(transformToParent);
  if (!ref)
    byTransform.set(transformToParent, ref = new ForeignIModelRef(refs, iModel, transformToParent));

  return ref;
}

/** Resolve the [[IModelDisplayReference]] to which graphics originating from `iModel` should be attributed when
 * displayed in the view owning `refs`: the reference displaying that iModel if it is part of the view, or otherwise
 * a reference identifying it as a foreign iModel. If an explicit `transformToParent` is supplied, a foreign reference
 * carrying that transform is always used, because the transform of a reference belonging to the view cannot be
 * overridden per-branch.
 */
export function resolveIModelDisplayReference(refs: IModelDisplayReferences, iModel: IModelConnection, transformToParent?: Transform): IModelDisplayReference {
  if (!transformToParent)
    for (const ref of refs)
      if (ref.iModel === iModel)
        return ref;

  return getForeignIModelDisplayReference(refs, iModel, transformToParent);
}
