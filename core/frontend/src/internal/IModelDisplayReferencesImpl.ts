/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent } from "@itwin/core-bentley";
import { _backingView, _implementationProhibited } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { IModelDisplayReferences2d, LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { SpatialViewState } from "../SpatialViewState";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { ViewState, ViewState2d } from "../ViewState";
import { createLinkedSpatialIModelDisplayReference } from "./LinkedSpatialIModelRef";
import { createPrimaryIModelDisplayReference2d, createPrimarySpatialIModelDisplayReference } from "./PrimaryIModelRef";
import { IModelConnection } from "../IModelConnection";

abstract class DisplayRefsImpl<R extends IModelDisplayReference, V extends ViewState> {
  public readonly [_implementationProhibited] = undefined;

  public readonly [_backingView]: V;

  protected abstract createPrimaryRef(view: V): R;

  public readonly primary: R;
  public readonly subcategories = new SubCategoriesCache.Queue();

  protected constructor(view: V) {
    this[_backingView] = view;
    this.primary = this.createPrimaryRef(view);
  }

  public abstract [Symbol.iterator](): Iterator<R>;
}

class DisplayRefs2dImpl extends DisplayRefsImpl<IModelDisplayReference2d, ViewState2d> implements IModelDisplayReferences2d {
  protected override createPrimaryRef(): IModelDisplayReference2d {
    return createPrimaryIModelDisplayReference2d(this)
  }

  public readonly is2d = true;

  public constructor(view: ViewState2d) {
    super(view);
  }

  public * [Symbol.iterator](): Iterator<IModelDisplayReference2d> {
    yield this.primary;
  }

  public get iModels(): Iterable<IModelConnection> {
    return [this.primary.iModel];
  }
}

class SpatialDisplayRefsImpl extends DisplayRefsImpl<SpatialIModelDisplayReference, SpatialViewState> implements SpatialIModelDisplayReferences {
  readonly #iModels = new Set<IModelConnection>();

  public readonly linked: SpatialIModelDisplayReference[] = [];

  protected override createPrimaryRef(): SpatialIModelDisplayReference {
    return createPrimarySpatialIModelDisplayReference(this);
  }

  public readonly isSpatial = true;

  public readonly onLinked = new BeEvent<(ref: SpatialIModelDisplayReference) => void>;
  public readonly onUnlinked = new BeEvent<(ref: SpatialIModelDisplayReference) => void>;

  public constructor(view: SpatialViewState) {
    super(view);
    this.#iModels.add(this.primary.iModel);
  }

  public * [Symbol.iterator](): Iterator<SpatialIModelDisplayReference> {
    yield this.primary;
    for (const linked of this.linked)
      yield linked;
  }

  public get iModels(): Iterable<IModelConnection> {
    return this.#iModels;
  }

  public link(args: LinkSpatialIModelArgs): SpatialIModelDisplayReference {
    const ref = createLinkedSpatialIModelDisplayReference(this, args);
    this.linked.push(ref);
    this.#iModels.add(ref.iModel);
    this.onLinked.raiseEvent(ref);
    return ref;
  }

  public unlink(refToRemove: SpatialIModelDisplayReference): void {
    const index = this.linked.indexOf(refToRemove);
    if (index !== -1) {
      this.linked.splice(index, 1);
      let removeIModel = true;
      for (const remainingRef of this) {
        if (remainingRef.iModel === refToRemove.iModel) {
          removeIModel = false;
          break;
        }
      }

      if (removeIModel)
        this.#iModels.delete(refToRemove.iModel);

      this.onUnlinked.raiseEvent(refToRemove);
    }
  }

}

/** @internal */
export function createIModelDisplayReferences2d(view: ViewState2d): IModelDisplayReferences2d {
  return new DisplayRefs2dImpl(view);
}

export function createSpatialIModelDisplayReferences(view: SpatialViewState): SpatialIModelDisplayReferences {
  return new SpatialDisplayRefsImpl(view);
}
