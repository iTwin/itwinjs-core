/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContentView */

import { UiError } from "@bentley/ui-core";

import { ContentLayoutDef } from "./ContentLayout";
import { ContentGroup } from "./ContentGroup";
import { ContentLayoutProps } from "./ContentLayoutProps";

import { UiFramework } from "../UiFramework";
import { FrontstageManager } from "../frontstage/FrontstageManager";

/** ContentLayout Manager class.
 * @public
 */
export class ContentLayoutManager {
  private static _layoutDefs: Map<string, ContentLayoutDef> = new Map<string, ContentLayoutDef>();

  /** Loads one or more Content Layouts.
   * @param layoutPropsList  the list of Content Layout properties to load
   */
  public static loadLayouts(layoutPropsList: ContentLayoutProps[]): void {
    layoutPropsList.map((layoutProps, _index) => {
      ContentLayoutManager.loadLayout(layoutProps);
    });
  }

  /** Loads a Content Layout.
   * @param layoutProps  the properties of the Content Layout to load
   */
  public static loadLayout(layoutProps: ContentLayoutProps): void {
    const layout = new ContentLayoutDef(layoutProps);
    if (layoutProps.id)
      ContentLayoutManager.addLayout(layoutProps.id, layout);
    else
      throw new UiError(UiFramework.loggerCategory(this), `loadLayout: ContentLayoutProps should contain an 'id'`);
  }

  /** Finds a Content Layout with a given id.
   * @param layoutId  the id of the Content Layout to find
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static findLayout(layoutId: string): ContentLayoutDef | undefined {
    return ContentLayoutManager._layoutDefs.get(layoutId);
  }

  /** Adds a Content Layout.
   * @param layoutId  the id of the Content Layout to add
   * @param layoutDef  the Content Layout definition to add
   */
  public static addLayout(layoutId: string, layoutDef: ContentLayoutDef): void {
    ContentLayoutManager._layoutDefs.set(layoutId, layoutDef);
  }

  /** Gets the active Content Layout */
  public static get activeLayout(): ContentLayoutDef | undefined {
    let layoutDef: ContentLayoutDef | undefined;
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

    if (activeFrontstageDef)
      layoutDef = activeFrontstageDef.contentLayoutDef;

    return layoutDef;
  }

  /** Gets the active Content Group */
  public static get activeContentGroup(): ContentGroup | undefined {
    let contentGroup: ContentGroup | undefined;
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;

    if (activeFrontstageDef)
      contentGroup = activeFrontstageDef.contentGroup;

    return contentGroup;
  }

  /** Sets the active Content Layout, Content Group and Content Control.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    await FrontstageManager.setActiveLayout(contentLayoutDef, contentGroup);
  }

  /** Refreshes the active layout and content group.
   */
  public static refreshActiveLayout(): void {
    // istanbul ignore else
    const activeFrontstageDef = FrontstageManager.activeFrontstageDef;
    if (activeFrontstageDef && activeFrontstageDef.contentLayoutDef && activeFrontstageDef.contentGroup) {
      FrontstageManager.onContentLayoutActivatedEvent.emit({
        contentLayout: activeFrontstageDef.contentLayoutDef,
        contentGroup: activeFrontstageDef.contentGroup,
      });

      activeFrontstageDef.contentGroup.refreshContentNodes();
    }
  }
}
