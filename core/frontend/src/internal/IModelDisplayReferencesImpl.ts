/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { _implementationProhibited } from "../common/internal/Symbols";
import { IModelDisplayReference, IModelDisplayReference2d, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { IModelDisplayReferences2d, LinkIModel2dArgs, LinkSpatialIModelArgs, SpatialIModelDisplayReferences } from "../IModelDisplayReferences";
import { SpatialViewState } from "../SpatialViewState";
import { SubCategoriesCache } from "../SubCategoriesCache";
import { ViewState, ViewState2d } from "../ViewState";
import { createLinkedIModelDisplayReference2d, createLinkedSpatialIModelDisplayReference } from "./LinkedIModelRef";
import { createPrimarySpatialIModelDisplayReference, createPrimaryIModelDisplayReference2d } from "./PrimaryIModelRef";

abstract class DisplayRefsImpl<R extends IModelDisplayReference, V extends ViewState, A extends LinkIModel2dArgs | LinkSpatialIModelArgs> {
  public readonly [_implementationProhibited] = undefined;

  protected readonly _view: V;

  protected abstract createPrimaryRef(view: V): R;
  protected abstract createLinkedRef(args: A): R;

  public readonly primary: R;
  public readonly linked: R[] = [];
  public readonly subcategories = new SubCategoriesCache.Queue();

  protected constructor(view: V) {
    this._view = view;
    this.primary = this.createPrimaryRef(view);
  }

  public link(args: A): R {
    const ref = this.createLinkedRef(args);
    this.linked.push(ref);
    return ref;
  }

  public unlink(ref: R): void {
    const index = this.linked.indexOf(ref);
    if (index !== -1) {
      // ###TODO dispose
      this.linked.splice(index, 1);
    }
  }

  public * [Symbol.iterator](): Iterator<R> {
    yield this.primary;
    for (const linked of this.linked)
      yield linked;
  }
}

class DisplayRefs2dImpl extends DisplayRefsImpl<IModelDisplayReference2d, ViewState2d, LinkIModel2dArgs> implements IModelDisplayReferences2d {
  protected override createPrimaryRef(view: ViewState2d): IModelDisplayReference2d {
    return createPrimaryIModelDisplayReference2d(view)
  }

  protected override createLinkedRef(args: LinkIModel2dArgs): IModelDisplayReference2d {
    return createLinkedIModelDisplayReference2d(this, args)
  }

  public readonly is2d = true;

  public constructor(view: ViewState2d) {
    super(view);
  }
}

class SpatialDisplayRefsImpl extends DisplayRefsImpl<SpatialIModelDisplayReference, SpatialViewState, LinkSpatialIModelArgs> implements SpatialIModelDisplayReferences {
  protected override createPrimaryRef(view: SpatialViewState): SpatialIModelDisplayReference {
    return createPrimarySpatialIModelDisplayReference(view);
  }

  protected override createLinkedRef(args: LinkSpatialIModelArgs): SpatialIModelDisplayReference {
    return createLinkedSpatialIModelDisplayReference(this, args);
  }

  public readonly isSpatial = true;

  public constructor(view: SpatialViewState) {
    super(view);
  }
}

export function createIModelDisplayReferences2d(view: ViewState2d): IModelDisplayReferences2d {
  return new DisplayRefs2dImpl(view);
}

export function createSpatialIModelDisplayReferences(view: SpatialViewState): SpatialIModelDisplayReferences {
  return new SpatialDisplayRefsImpl(view);
}
