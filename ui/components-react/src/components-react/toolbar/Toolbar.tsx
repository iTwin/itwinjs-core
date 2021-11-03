/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Toolbar.scss";
import classnames from "classnames";
import * as React from "react";
import {
  CommonToolbarItem, OnItemExecutedFunc,
} from "@itwin/appui-abstract";
import { CommonProps, NoChildrenProps } from "@itwin/core-react";
import { ToolbarItems } from "./Items";
import { Direction, OrthogonalDirection, OrthogonalDirectionHelpers } from "./utilities/Direction";
import { getToolbarDirection, ToolbarItemComponent, ToolbarItemContext, ToolbarOpacitySetting, ToolbarPanelAlignment, ToolbarWithOverflowDirectionContext } from "./ToolbarWithOverflow";

/** Properties of [[Toolbar]] component.
 * @public
 */
export interface ToolbarProps extends CommonProps, NoChildrenProps {
  /** Describes to which direction the popup panels are expanded. Defaults to: [[Direction.Bottom]] */
  expandsTo?: Direction;
  /** definitions for items of the toolbar. i.e. [[CommonToolbarItem]]. Items are expected to be already sorted by group and item. */
  items: CommonToolbarItem[];
  /** Describes how expanded panels are aligned. Defaults to: [[ToolbarPanelAlignment.Start]] */
  panelAlignment?: ToolbarPanelAlignment;
  /** Use Drag Interaction to open popups with nest action buttons */
  useDragInteraction?: boolean;
  /** Determines whether to use mouse proximity to alter the opacity of the toolbar */
  toolbarOpacitySetting?: ToolbarOpacitySetting;
  /** Optional function to call on any item execution */
  onItemExecuted?: OnItemExecutedFunc;
  /** Optional function to call on any KeyDown events processed by toolbar */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

function getItemWrapperClass(child: React.ReactNode) {
  // istanbul ignore else
  if (React.isValidElement(child)) {
    if (child.props && child.props.addGroupSeparator)
      return "components-toolbar-button-add-gap-before";
  }
  return "";
}

/** Component that displays tool settings as a bar across the top of the content view.
 * @public
 */
export function Toolbar(props: ToolbarProps) {
  const expandsTo = props.expandsTo ? props.expandsTo : Direction.Bottom;
  const useDragInteraction = !!props.useDragInteraction;
  const panelAlignment = props.panelAlignment ? props.panelAlignment : ToolbarPanelAlignment.Start;
  const [popupPanelCount, setPopupPanelCount] = React.useState(0);

  const handlePopupPanelOpenClose = React.useCallback((isOpening: boolean) => {
    // use setImmediate to avoid warning about setting state in Toolbar from render method of PopupItem/PopupItemWithDrag
    setImmediate(() => {
      setPopupPanelCount((prev) => {
        const nextCount = isOpening ? (prev + 1) : (prev - 1);
        // eslint-disable-next-line no-console
        // console.log(`new popup count = ${nextCount}`);
        return nextCount < 0 ? /* istanbul ignore next */ 0 : nextCount;
      });
    });
  }, []);

  const availableNodes = React.useMemo<React.ReactNode[]>(() => {
    return props.items.map((item, index) => {
      let addGroupSeparator = false;
      if (index > 0)
        addGroupSeparator = item.groupPriority !== props.items[index - 1].groupPriority;
      return (
        <ToolbarItemComponent
          key={item.id}
          item={item}
          addGroupSeparator={!!addGroupSeparator}
        />
      );
    });
  }, [props.items]);

  const direction = getToolbarDirection(expandsTo);
  const className = classnames(
    "components-toolbar-overflow-sizer",
    OrthogonalDirectionHelpers.getCssClassName(direction),
    props.className);

  // needed to construct DOM structure identical to ToolbarWithOverflow so same css can be applied.
  const wrapperClassName = classnames(
    "components-toolbar-item-container",
    OrthogonalDirectionHelpers.getCssClassName(direction),
  );

  return (
    <ToolbarWithOverflowDirectionContext.Provider value={
      {
        expandsTo, direction, overflowExpandsTo: Direction.Right, panelAlignment, useDragInteraction,
        toolbarOpacitySetting: props.toolbarOpacitySetting ? props.toolbarOpacitySetting : ToolbarOpacitySetting.Proximity,
        overflowDirection: OrthogonalDirection.Horizontal,
        openPopupCount: popupPanelCount, onPopupPanelOpenClose: handlePopupPanelOpenClose, overflowDisplayActive: false,
        onItemExecuted: props.onItemExecuted ? props.onItemExecuted : /* istanbul ignore next */ () => { },
        onKeyDown: props.onKeyDown ? props.onKeyDown : /* istanbul ignore next */ (_e: React.KeyboardEvent) => { },
      }
    }>
      <ToolbarItemContext.Provider
        value={{
          hasOverflow: false,
          useHeight: false,
          onResize: /* istanbul ignore next */ () => { },
        }}
      >
        {(availableNodes.length > 0) &&
          <div
            className={className}
            style={props.style}
            onKeyDown={props.onKeyDown}
            role="presentation"
          >
            <ToolbarItems
              className="components-items"
              direction={direction}
            >
              {availableNodes.map((child, index) => <div key={index} className={`${wrapperClassName} ${getItemWrapperClass(child)}`}>{child}</div>)}
            </ToolbarItems>
          </div>
        }
      </ToolbarItemContext.Provider>
    </ToolbarWithOverflowDirectionContext.Provider >
  );
}
