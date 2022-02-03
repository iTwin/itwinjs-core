/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./PopupItem.scss";
import classnames from "classnames";
import * as React from "react";
import type { ActionButton, GroupButton} from "@itwin/appui-abstract";
import { ConditionalBooleanValue, ConditionalStringValue, RelativePosition, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { BadgeUtilities, IconHelper, useRefState } from "@itwin/core-react";
import type { ToolbarButtonItemProps } from "./Item";
import { PopupItemPopup, ToolbarPopupContext } from "./PopupItem";
import { PopupItemsPanel } from "./PopupItemsPanel";
import { ToolbarPanelAlignment, useToolbarWithOverflowDirectionContext, useToolItemEntryContext } from "./ToolbarWithOverflow";
import { useDragInteraction } from "./useDragInteraction";
import { Direction } from "./utilities/Direction";

/** Properties of [[PopupItem]] component.
 * @public
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
 * @public
 */
export function PopupItemWithDrag(props: PopupItemWithDragProps) {
  const [isPanelShown, setPanelShown] = React.useState(false);
  const [activeAction, setActiveAction] = React.useState(getActiveAction(props.groupItem));
  const { expandsTo, overflowExpandsTo, panelAlignment, onPopupPanelOpenClose } = useToolbarWithOverflowDirectionContext();

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
      // istanbul ignore else
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
    // only execute action if not disabled
    activeAction && !ConditionalBooleanValue.getValue(activeAction.isDisabled) && activeAction.execute();
  }, [activeAction]);

  const badge = activeAction ? BadgeUtilities.getComponentForBadgeType(activeAction.badgeType) : props.badge;
  const icon = activeAction ? IconHelper.getIconReactNode(activeAction.icon, activeAction.internalData) : props.icon;
  const title = activeAction ? ConditionalStringValue.getValue(activeAction.label) : props.title;
  const isActive = activeAction ? activeAction.isActive : props.isActive;
  const isDisabled = ConditionalBooleanValue.getValue(activeAction ? activeAction.isDisabled : props.isDisabled);

  const { handlePointerDown, handleButtonClick } = useDragInteraction(onGroupButtonClick, onOpenPanel);

  const className = classnames(
    "components-toolbar-button-item",
    "components-toolbar-expandable-button",
    isActive && "components-active",
    isDisabled && "components-disabled-drag",
    props.className);

  const [targetRef, target] = useRefState<HTMLButtonElement>();
  const handleClose = React.useCallback(() => {
    processPanelOpenClose(false);
  }, [processPanelOpenClose]);
  const { hasOverflow } = useToolItemEntryContext();
  const expandsToDirection = hasOverflow ? /* istanbul ignore next */ overflowExpandsTo : expandsTo;

  return (
    <ToolbarPopupContext.Provider value={{
      closePanel: /* istanbul ignore next */ () => processPanelOpenClose(false),
      setSelectedItem: /* istanbul ignore next */ (buttonItem: ActionButton) => setActiveAction(buttonItem),
    }
    }>
      <button
        ref={targetRef}
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
      <PopupItemPopup
        isOpen={isPanelShown}
        onClose={handleClose}
        position={toToolbarPopupRelativePosition(expandsToDirection, panelAlignment)}
        target={target}
      >
        <PopupItemsPanel groupItem={props.groupItem} activateOnPointerUp={true} />
      </PopupItemPopup>
    </ToolbarPopupContext.Provider>
  );
}

/** @internal */
export function toToolbarPopupRelativePosition(expandsTo: Direction, alignment: ToolbarPanelAlignment): RelativePosition {
  // istanbul ignore next
  switch (expandsTo) {
    case Direction.Bottom: {
      if (alignment === ToolbarPanelAlignment.End)
        return RelativePosition.BottomRight;
      return RelativePosition.BottomLeft;
    }
    case Direction.Left:
      return RelativePosition.LeftTop;
    case Direction.Right:
      return RelativePosition.RightTop;
    case Direction.Top:
      return RelativePosition.Top;
  }
}
