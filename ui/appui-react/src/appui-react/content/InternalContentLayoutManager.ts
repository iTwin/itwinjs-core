/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import { ContentLayoutProps } from "@itwin/appui-abstract";
import { UiFramework } from "../UiFramework";
import { ContentGroup, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutDef } from "./ContentLayout";

/** ContentLayout Manager class.
 * @internal
 */
export class InternalContentLayoutManager {
  private static _layoutDefs: Map<string, ContentLayoutDef> = new Map<string, ContentLayoutDef>();

  /** build a layout key that is unique for group layout combination */
  public static getLayoutKey(props: { contentGroupId: string, layoutId: string }): string {
    return `${props.contentGroupId}-${props.layoutId}`;
  }

  /** Return a LayoutDef that is specific to a content group.
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static getLayoutForGroup(contentGroupProps: ContentGroupProps | ContentGroup, overrideContentLayout?: ContentLayoutProps): ContentLayoutDef {
    const layoutId = overrideContentLayout?.id ?? contentGroupProps.layout.id;
    const layoutKey = this.getLayoutKey({ contentGroupId: contentGroupProps.id, layoutId });

    if (!overrideContentLayout && InternalContentLayoutManager._layoutDefs.has(layoutKey)) {
      return InternalContentLayoutManager._layoutDefs.get(layoutKey)!;
    }

    const newContentLayoutProps = { ...contentGroupProps.layout, ...overrideContentLayout };
    const newLayoutDef = new ContentLayoutDef(newContentLayoutProps);
    this.addLayout(layoutKey, newLayoutDef);
    return newLayoutDef;
  }

  /** Finds a Content Layout with a given id.
   * @param layoutKey  group specific layout id, see `getLayoutKey`
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static findLayout(layoutKey: string): ContentLayoutDef | undefined {
    return InternalContentLayoutManager._layoutDefs.get(layoutKey)!;
  }

  /** Adds a Content Layout.
   * @param layoutId  the id of the Content Layout to add
   * @param layoutDef  the Content Layout definition to add
   */
  public static addLayout(layoutId: string, layoutDef: ContentLayoutDef): void {
    InternalContentLayoutManager._layoutDefs.set(layoutId, layoutDef);
  }

  /** Gets the active Content Layout */
  public static get activeLayout(): ContentLayoutDef | undefined {
    let layoutDef: ContentLayoutDef | undefined;
    const activeFrontstageDef = UiFramework.frontstages.activeFrontstageDef;

    if (activeFrontstageDef)
      layoutDef = activeFrontstageDef.contentLayoutDef;

    return layoutDef;
  }

  /** Gets the active Content Group */
  public static get activeContentGroup(): ContentGroup | undefined {
    let contentGroup: ContentGroup | undefined;
    const activeFrontstageDef = UiFramework.frontstages.activeFrontstageDef;

    if (activeFrontstageDef)
      contentGroup = activeFrontstageDef.contentGroup;

    return contentGroup;
  }

  /** Sets the active Content Layout, Content Group and Content Control.
   * @param contentLayoutDef  Content layout to make active
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveLayout(contentLayoutDef: ContentLayoutDef, contentGroup: ContentGroup): Promise<void> {
    await UiFramework.frontstages.setActiveLayout(contentLayoutDef, contentGroup);
  }

  /** Sets the active Content Group.
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveContentGroup(contentGroup: ContentGroup): Promise<void> {
    await UiFramework.frontstages.setActiveContentGroup(contentGroup);
  }

  /** Refreshes the active layout and content group.
   */
  public static refreshActiveLayout(): void {
    // istanbul ignore else
    const activeFrontstageDef = UiFramework.frontstages.activeFrontstageDef;
    if (activeFrontstageDef && activeFrontstageDef.contentLayoutDef && activeFrontstageDef.contentGroup) {
      UiFramework.frontstages.onContentLayoutActivatedEvent.emit({
        contentLayout: activeFrontstageDef.contentLayoutDef,
        contentGroup: activeFrontstageDef.contentGroup,
      });

      activeFrontstageDef.contentGroup.refreshContentNodes();
    }
  }
}
