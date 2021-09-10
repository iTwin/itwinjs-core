/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContentView
 */

import { ContentLayoutProps, StandardContentLayouts } from "@bentley/ui-abstract";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { ContentGroup, ContentGroupProps } from "./ContentGroup";
import { ContentLayoutDef } from "./ContentLayout";

/** ContentLayout Manager class.
 * @public
 */
export class ContentLayoutManager {
  private static _layoutProps: Map<string, ContentLayoutProps> = new Map<string, ContentLayoutProps>();
  private static _layoutDefs: Map<string, ContentLayoutDef> = new Map<string, ContentLayoutDef>();

  /** Loads one or more Content Layouts.
   * @param layoutPropsList  the list of Content Layout properties to load
   */
  public static loadLayouts(layoutPropsList: ContentLayoutProps[]): void {
    layoutPropsList.forEach((layoutProps) => {
      ContentLayoutManager.loadLayout(layoutProps);
    });
  }

  /** Loads a Content Layout.
   * @param layoutProps  the properties of the Content Layout to load
   */
  public static loadLayout(layoutProps: ContentLayoutProps): void {
    if (!ContentLayoutManager._layoutProps.has(layoutProps.id))
      ContentLayoutManager._layoutProps.set(layoutProps.id, layoutProps);
  }

  /** Return a LayoutDef that is specific to a content group.
   * @returns the [[ContentLayoutDef]] if found, or throws if the ContentLayoutProps can't be returned
   */
  public static getLayoutPropsForGroup(contentGroupProps: ContentGroupProps | ContentGroup): ContentLayoutProps {
    const layoutId = (typeof contentGroupProps.layout !== "string") ? contentGroupProps.layout.id : contentGroupProps.layout;
    if (ContentLayoutManager._layoutProps.has(layoutId)) {
      return ContentLayoutManager._layoutProps.get(layoutId)!;
    } else if (typeof contentGroupProps.layout !== "string") {
      ContentLayoutManager.loadLayout(contentGroupProps.layout);
      return contentGroupProps.layout;
    } else if (StandardContentLayouts.availableLayouts) {
      const contentLayoutProps = StandardContentLayouts.availableLayouts.find((props: ContentLayoutProps) => props.id === layoutId);
      if (contentLayoutProps) {
        const newContentLayoutProps = { ...contentLayoutProps };
        ContentLayoutManager.loadLayout(newContentLayoutProps);
        return newContentLayoutProps;
      }
    }
    throw new Error(`Unable to located ContentLayoutProps with id ${layoutId}`);
  }

  /** build a layout key that is unique for group layout combination */
  public static getLayoutKey(props: { contentGroupId: string, layoutId: string }): string {
    return `${props.contentGroupId}-${props.layoutId}`;
  }

  /** Return a LayoutDef that is specific to a content group.
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static getLayoutForGroup(contentGroupProps: ContentGroupProps | ContentGroup, overrideContentLayout?: ContentLayoutProps): ContentLayoutDef {
    const layoutId = overrideContentLayout?.id ?? ((typeof contentGroupProps.layout !== "string") ? contentGroupProps.layout.id : contentGroupProps.layout);
    const layoutKey = this.getLayoutKey({ contentGroupId: contentGroupProps.id, layoutId });

    if (overrideContentLayout)
      ContentLayoutManager.loadLayout(overrideContentLayout);

    if (ContentLayoutManager._layoutDefs.has(layoutKey)) {
      return ContentLayoutManager._layoutDefs.get(layoutKey)!;
    } else if (typeof contentGroupProps.layout !== "string") {
      const newContentLayoutProps = { ...contentGroupProps.layout };
      const newLayoutDef = new ContentLayoutDef(newContentLayoutProps);
      this.addLayout(layoutKey, newLayoutDef);
      return newLayoutDef;
    } else if (StandardContentLayouts.availableLayouts) {
      const contentLayoutProps = StandardContentLayouts.availableLayouts.find((props: ContentLayoutProps) => props.id === layoutId);
      if (contentLayoutProps) {
        const newContentLayoutProps = { ...contentLayoutProps };
        const newLayoutDef = new ContentLayoutDef(newContentLayoutProps);
        this.addLayout(layoutKey, newLayoutDef);
        return newLayoutDef;
      }
    }
    throw new Error(`Unable to located ContentLayout with id ${layoutId}`);
  }

  /** Finds a Content Layout with a given id.
   * @param layoutKey  group specific layout id, see `getLayoutKey`
   * @returns the [[ContentLayoutDef]] if found, or undefined otherwise
   */
  public static findLayout(layoutKey: string): ContentLayoutDef | undefined {
    return ContentLayoutManager._layoutDefs.get(layoutKey)!;
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

  /** Sets the active Content Group.
   * @param contentGroup  Content Group to make active
   */
  public static async setActiveContentGroup(contentGroup: ContentGroup): Promise<void> {
    await FrontstageManager.setActiveContentGroup(contentGroup);
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
