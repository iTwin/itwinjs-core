/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import { ContentLayoutProps } from "@itwin/appui-abstract";
import { ContentGroup, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutDef } from "./ContentLayout";
import { InternalContentLayoutManager as internal } from "./InternalContentLayoutManager";

/** ContentLayout Manager class.
 * @public
 * @deprecated in 3.7. Use `UiFramework.content.layouts` property.
 */
export class ContentLayoutManager {
  /** build a layout key that is unique for group layout combination */
  public static getLayoutKey(props: { contentGroupId: string, layoutId: string }): string {
    return internal.getKey(props);
  }

  /** Return a LayoutDef that is specific to a content group.
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static getLayoutForGroup(contentGroupProps: ContentGroupProps | ContentGroup, overrideContentLayout?: ContentLayoutProps): ContentLayoutDef {
    return internal.getForGroup(contentGroupProps, overrideContentLayout);
  }

  /** Finds a Content Layout with a given id.
   * @param layoutKey  group specific layout id, see `getLayoutKey`
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static findLayout(layoutKey: string): ContentLayoutDef | undefined {
    return internal.find(layoutKey);
  }

  /** Adds a Content Layout.
   * @param layoutId  the id of the Content Layout to add
   * @param layoutDef  the Content Layout definition to add
   */
  public static addLayout(layoutId: string, layoutDef: ContentLayoutDef): void {
    return internal.add(layoutId, layoutDef);
  }

  /** Gets the active Content Layout */
  public static get activeLayout(): ContentLayoutDef | undefined {
    return internal.activeLayout;
  }

  /** Gets the active Content Group */
  public static get activeContentGroup(): ContentGroup | undefined {
    return internal.activeContentGroup;
  }

  /** Sets the active Content Layout, Content Group and Content Control.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    return internal.setActive(contentLayoutDef, contentGroup);
  }

  /** Sets the active Content Group.
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveContentGroup(contentGroup: ContentGroup): Promise<void> {
    return internal.setActiveContentGroup(contentGroup);
  }

  /** Refreshes the active layout and content group.
   */
  public static refreshActiveLayout(): void {
    return internal.refreshActive();
  }
}

