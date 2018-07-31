/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import { BreadcrumbRoot, BreadcrumbItem } from "./BreadcrumbTreeData";
import { UiEvent } from "@bentley/ui-core";

/** BreadcrumbChangeEvent Event Args class.
 */
export interface BreadcrumbUpdateEventArgs {
  root: BreadcrumbRoot;
  currentNode: BreadcrumbItem;
}

/** BreadcrumbChangeEvent Event class.
 */
export class BreadcrumbUpdateEvent extends UiEvent<BreadcrumbUpdateEventArgs> { }

/** Breadcrumb Path class.
 */
export class BreadcrumbPath {
  private _root!: BreadcrumbRoot;
  private _currentNode!: BreadcrumbItem;
  private _breadcrumbUpdateEvent: BreadcrumbUpdateEvent = new BreadcrumbUpdateEvent();

  public get BreadcrumbUpdateEvent(): BreadcrumbUpdateEvent { return this._breadcrumbUpdateEvent; }

  public getRoot() {
    return this._root;
  }

  public getCurrentNode() {
    return this._currentNode;
  }

  public setBreadcrumbData(root?: BreadcrumbRoot, currentNode?: BreadcrumbItem): void {
    if (root)
      this._root = root;
    if (currentNode)
      this._currentNode = currentNode;
    this.BreadcrumbUpdateEvent.emit({ root: root || this._root, currentNode: currentNode || this._currentNode });
  }
}
