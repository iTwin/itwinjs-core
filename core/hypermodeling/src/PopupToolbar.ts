/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module HyperModeling
 */

import { XAndY } from "@itwin/core-geometry";
import { AbstractToolbarProps } from "@itwin/appui-abstract";
import { IModelApp } from "@itwin/core-frontend";

/** @internal */
export interface PopupToolbarProvider {
  toolbarProps: AbstractToolbarProps;
  overToolbarHotspot: boolean;
  toolbarLocation: XAndY;
  htmlElement: HTMLElement | undefined;
  onToolbarItemExecuted(id: string): void;
}

/** @internal */
export class PopupToolbarManager {
  private static _provider?: PopupToolbarProvider;
  private static _current?: PopupToolbarProvider;

  private static show(): boolean {
    const prov = this._provider;
    if (!prov || !prov.overToolbarHotspot)
      return false;

    const admin = IModelApp.uiAdmin;
    if (!admin.showToolbar(prov.toolbarProps, prov.toolbarLocation, admin.createXAndY(0, 0), this._itemExecuted, this._cancel, undefined, prov.htmlElement))
      return false;

    this._current = this._provider;
    this._provider = undefined;
    this.closeAfterTimeout();
    return true;
  }

  private static _itemExecuted = (item: any) => {
    const mgr = PopupToolbarManager;
    if (mgr._current)
      mgr._current.onToolbarItemExecuted(item.id);

    mgr.close();
  };

  private static _cancel = () => {
    const mgr = PopupToolbarManager;
    if (!mgr._current || !mgr._current.overToolbarHotspot)
      mgr.close(); // Don't hide when click is over hotspot
  };

  private static close(): boolean {
    this._current = undefined;
    return IModelApp.uiAdmin.hideToolbar();
  }

  private static closeAfterTimeout(): void {
    if (!this._current)
      return;

    if (this._current.overToolbarHotspot || !IModelApp.toolAdmin.cursorView)
      setTimeout(() => this.closeAfterTimeout(), 500); // Cursor not in view or over hotspot, check again
    else
      this.close();
  }

  public static showToolbarAfterTimeout(provider: PopupToolbarProvider): void {
    if (this._current === provider)
      return;

    this._provider = provider;
    setTimeout(() => this.show(), 500);
  }
}
