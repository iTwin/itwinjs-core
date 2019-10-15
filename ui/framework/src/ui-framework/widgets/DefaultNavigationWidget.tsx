/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { NavigationWidget } from "./NavigationWidget";
import { CoreTools } from "../CoreToolDefinitions";
import { GroupItemDef } from "../toolbar/GroupItem";
import { UiFramework } from "../UiFramework";
import { ItemList } from "../shared/ItemMap";

/** Properties that can be used to append items to the default set of toolbar items of [[DefaultNavigationWidget]].
 * @beta
 */
export interface DefaultNavigationProps {
  /** Item to add before the default items in the horizontal toolbar */
  prefixHorizontalItems?: ItemList;
  /** Item to add after the default items in the horizontal toolbar */
  suffixHorizontalItems?: ItemList;
  /** Item to add before the default items in the vertical toolbar */
  prefixVerticalItems?: ItemList;
  /** Item to add after the default items in the vertical toolbar */
  suffixVerticalItems?: ItemList;
}

/** Default Navigation Widget for zone 3. Provides standard view manipulation tools and displays registered Navigation Aids as corner item.
 * This definition will also show a overflow button if there is not enough room to display all the toolbar buttons.
 * @beta
 */
export class DefaultNavigationWidget extends React.Component<DefaultNavigationProps> {

  private _zoomGroupItemDef = new GroupItemDef({
    groupId: "default-navigation-zoom-group",
    labelKey: "UiFramework:tools.viewZoomingTools",
    iconSpec: "icon-zoom-in-2",
    items: [CoreTools.fitViewCommand, CoreTools.windowAreaCommand],
    itemsInColumn: 2,
  });

  private _horizontalToolbarItems = new ItemList([
    CoreTools.rotateViewCommand,
    CoreTools.panViewCommand,
    this._zoomGroupItemDef,
    CoreTools.viewUndoCommand,
    CoreTools.viewRedoCommand,
  ]);

  private _verticalToolbarItems = new ItemList([
    CoreTools.walkViewCommand,
    CoreTools.toggleCameraViewCommand,
  ]);

  public render() {
    const horizontalToolbarItems = new ItemList();
    if (this.props.prefixHorizontalItems) horizontalToolbarItems.addItems(this.props.prefixHorizontalItems);
    if (this._horizontalToolbarItems) horizontalToolbarItems.addItems(this._horizontalToolbarItems);
    if (this.props.suffixHorizontalItems) horizontalToolbarItems.addItems(this.props.suffixHorizontalItems);

    const verticalToolbarItems = new ItemList();
    if (this.props.prefixVerticalItems) verticalToolbarItems.addItems(this.props.prefixVerticalItems);
    if (this._verticalToolbarItems) verticalToolbarItems.addItems(this._verticalToolbarItems);
    if (this.props.suffixVerticalItems) verticalToolbarItems.addItems(this.props.suffixVerticalItems);

    return (
      <NavigationWidget
        navigationAidId="CubeNavigationAid"
        iModelConnection={UiFramework.getIModelConnection()}
        horizontalItems={horizontalToolbarItems}
        verticalItems={verticalToolbarItems}
      />
    );
  }
}
