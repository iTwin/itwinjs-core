/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { GroupButton, ActionButton, ToolbarItemUtilities, ConditionalStringValue } from "@bentley/ui-abstract";
import { BadgeUtilities, IconHelper, useOnOutsideClick } from "@bentley/ui-core";
import { useToolbarWithOverflowDirectionContext, useToolItemEntryContext } from "./Toolbar";
import { DirectionHelpers, OrthogonalDirectionHelpers } from "./utilities/Direction";
import { ToolbarPanelAlignmentHelpers } from "../toolbar/Toolbar";
import { useDragInteraction } from "./useDragInteraction";
import { ToolbarButtonItemProps } from "./Item";
import { PopupItemsPanel } from "./PopupItemsPanel";
import { ToolbarPopupContext } from "./PopupItem";

import "./PopupItem.scss";
/** Properties of [[PopupItem]] component.
 * @beta
 */
export interface PopupItemWithDragProps extends ToolbarButtonItemProps {
  /** Panel of the toolbar. */
  groupItem: GroupButton;
}

function tryFindActiveAction(item: GroupButton): ActionButton | undefined {
  for (const childItem of item.items) {
    // istanbul ignore else
    if (ToolbarItemUtilities.isActionButton(childItem)) {
      if (childItem.isActive)
        return childItem;
    } else if (ToolbarItemUtilities.isGroupButton(childItem)) {
      const nestedChild = tryFindActiveAction(childItem);
      if (nestedChild)
        return nestedChild;
    }
  }
  return undefined;
}

function getFirstAvailableChildActionItem(item: GroupButton): ActionButton | undefined {
  for (const childItem of item.items) {
    if (ToolbarItemUtilities.isActionButton(childItem)) {
      return childItem;
    } else {
      // istanbul ignore else
      if (ToolbarItemUtilities.isGroupButton(childItem)) {
        const nestedChild = getFirstAvailableChildActionItem(childItem);
        // istanbul ignore else
        if (nestedChild)
          return nestedChild;
      }
    }
  }
  return undefined;
}

function getActiveAction(item: GroupButton): ActionButton | undefined {
  const activeItem = tryFindActiveAction(item);
  if (activeItem)
    return activeItem;

  // initially look only in root items
  for (const childItem of item.items) {
    // istanbul ignore else
    if (ToolbarItemUtilities.isActionButton(childItem)) {
      return childItem;
    }
  }

  // if not found look inside groups
  return getFirstAvailableChildActionItem(item);
}

/** Expandable Group button Item
 * @beta
 */
export function PopupItemWithDrag(props: PopupItemWithDragProps) {
  const [isPanelShown, setPanelShown] = React.useState(false);
  const [activeAction, setActiveAction] = React.useState(getActiveAction(props.groupItem));
  const { expandsTo, direction, overflowExpandsTo, overflowDirection, panelAlignment, onPopupPanelOpenClose } = useToolbarWithOverflowDirectionContext();

  React.useEffect(() => {
    const newActiveAction = getActiveAction(props.groupItem);
    // istanbul ignore else
    if (newActiveAction) {
      // istanbul ignore next
      if (newActiveAction.isActive) {
        setActiveAction(newActiveAction);
      } else {
        if (activeAction && activeAction.isActive) {
          setActiveAction({ ...activeAction, isActive: false });
        }
      }
    }
  }, [props.groupItem, activeAction]);

  const processPanelOpenClose = React.useCallback((isOpening: boolean) => {
    setPanelShown((prev) => {
      if (prev !== isOpening)
        onPopupPanelOpenClose(isOpening);
      return isOpening;
    });
  }, [setPanelShown, onPopupPanelOpenClose]);

  // handle open and closing popup panel
  const onOpenPanel = React.useCallback(() => {
    processPanelOpenClose(!isPanelShown);
  }, [isPanelShown, processPanelOpenClose]);

  // handle open and closing popup panel
  const onGroupButtonClick = React.useCallback(() => {
    // istanbul ignore else
    if (activeAction)
      activeAction.execute();
  }, [activeAction]);

  const badge = activeAction ? BadgeUtilities.getComponentForBadgeType(activeAction.badgeType) : props.badge;
  const icon = activeAction ? IconHelper.getIconReactNode(activeAction.icon, activeAction.internalData) : props.icon;
  const title = activeAction ? ConditionalStringValue.getValue(activeAction.label) : props.title;
  const isActive = activeAction ? activeAction.isActive : props.isActive;
  const isDisabled = activeAction ? activeAction.isDisabled : props.isDisabled;

  const { handlePointerDown, handleButtonClick } = useDragInteraction(onGroupButtonClick, onOpenPanel);

  const className = classnames(
    "components-toolbar-button-item",
    "components-toolbar-expandable-button",
    isActive && "components-active",
    isDisabled && "components-disabled",
    props.className);

  const ref = React.useRef<HTMLButtonElement>(null);
  const onOutsideClick = React.useCallback(
    // istanbul ignore next
    () => {
      processPanelOpenClose(false);
    }, [processPanelOpenClose]);
  const isOutsideEvent = React.useCallback((e: PointerEvent) => {
    // if clicking on button that open panel - don't trigger outside click processing
    return !!ref.current && (e.target instanceof Node) && !ref.current.contains(e.target);
  }, []);
  const panelRef = useOnOutsideClick<HTMLDivElement>(onOutsideClick, isOutsideEvent);
  const { hasOverflow } = useToolItemEntryContext();
  const panelClassName = classnames(
    "components-toolbar-popup-panel-container",
    hasOverflow && "components-overflown",
    OrthogonalDirectionHelpers.getCssClassName(hasOverflow ? overflowDirection : direction),
    DirectionHelpers.getCssClassName(hasOverflow ? overflowExpandsTo : expandsTo),
    ToolbarPanelAlignmentHelpers.getCssClassName(panelAlignment),
  );

  return (
    <ToolbarPopupContext.Provider value={{
      closePanel: /* istanbul ignore next */ () => processPanelOpenClose(false),
      setSelectedItem: /* istanbul ignore next */ (buttonItem: ActionButton) => setActiveAction(buttonItem),
    }
    }>
      <button
        ref={ref}
        disabled={props.isDisabled}  // this is needed to prevent focusing/keyboard access to disabled buttons
        onPointerDown={handlePointerDown}
        onClick={handleButtonClick}
        onKeyDown={props.onKeyDown}
        className={className}
        style={props.style}
        title={title}
      >
        <div className="components-icon">
          {icon}
        </div>
        {props.badge &&
          <div className="components-badge">
            {badge}
          </div>
        }
        <div className="components-triangle" />
      </button>
      {isPanelShown &&
        <div ref={panelRef} className={panelClassName}>
          <PopupItemsPanel groupItem={props.groupItem} activateOnPointerUp={true} />
        </div>
      }
    </ToolbarPopupContext.Provider>
  );
}
