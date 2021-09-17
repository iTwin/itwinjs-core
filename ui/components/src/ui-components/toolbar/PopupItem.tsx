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
import { ActionButton, RelativePosition } from "@bentley/ui-abstract";
import { Popup, useRefState } from "@bentley/ui-core";
import { ToolbarButtonItemProps } from "./Item";
import { useToolbarWithOverflowDirectionContext, useToolItemEntryContext } from "./ToolbarWithOverflow";
import { toToolbarPopupRelativePosition } from "./PopupItemWithDrag";

/** @public */
export interface ToolbarPopupContextProps {
  readonly closePanel: () => void;
  readonly setSelectedItem?: (buttonItem: ActionButton) => void;
}

/**
 * Context used by Toolbar items in popups to close the popup panel.
 * @public
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const ToolbarPopupContext = React.createContext<ToolbarPopupContextProps>({
  /** function used to close popup panel */
  closePanel: /* istanbul ignore next */ () => { },
  /** if popup panel is a GroupButton then this is call to set the selected action item within the panel */
  setSelectedItem: /* istanbul ignore next */  (_buttonItem: ActionButton) => { },
});

/**
 * React hook used to retrieve the ToolbarPopupContext.
 *  @public
 */
export function useToolbarPopupContext() {
  return React.useContext(ToolbarPopupContext);
}

/** Properties of [[PopupItem]] component.
 * @beta
 */
export interface PopupItemProps extends ToolbarButtonItemProps {
  /** Describes if expandable item triangle indicator should be hidden. */
  hideIndicator?: boolean;
  /** Panel of the toolbar. */
  panel?: React.ReactNode;
}

/** Popup toolbar item that displays a panel
 * @beta
 */
export function PopupItem(props: PopupItemProps) {
  const [isPanelShown, setPanelShown] = React.useState(false);
  const { expandsTo, overflowExpandsTo, panelAlignment, onPopupPanelOpenClose } = useToolbarWithOverflowDirectionContext();
  const processPanelOpenClose = React.useCallback((isOpening: boolean) => {
    setPanelShown((prev) => {
      // istanbul ignore else
      if (prev !== isOpening)
        onPopupPanelOpenClose(isOpening);
      return isOpening;
    });
  }, [setPanelShown, onPopupPanelOpenClose]);

  // handle open and closing overflow panel
  const onButtonClick = React.useCallback(() => {
    processPanelOpenClose(!isPanelShown);
    // istanbul ignore next
    if (props.onClick)
      props.onClick();
  }, [props, isPanelShown, processPanelOpenClose]);
  const className = classnames(
    "components-toolbar-button-item",
    "components-toolbar-expandable-button",
    props.isDisabled && "components-disabled",
    props.className);

  const [targetRef, target] = useRefState<HTMLButtonElement>();
  // istanbul ignore next
  const handleClose = React.useCallback(() => {
    processPanelOpenClose(false);
  }, [processPanelOpenClose]);
  const { hasOverflow } = useToolItemEntryContext();
  const expandsToDirection = hasOverflow ? overflowExpandsTo : expandsTo;

  const { hideIndicator, panel } = props;
  return (
    <ToolbarPopupContext.Provider value={{
      closePanel: () => processPanelOpenClose(false),
    }}>
      <button
        data-item-id={props.itemId}
        data-item-type="tool-button"
        ref={targetRef}
        disabled={props.isDisabled}  // this is needed to prevent focusing/keyboard access to disabled buttons
        onClick={onButtonClick}
        onKeyDown={props.onKeyDown}
        className={className}
        style={props.style}
        title={props.title}
      >
        <div className="components-icon">
          {props.icon}
        </div>
        {props.badge &&
          <div className="components-badge">
            {props.badge}
          </div>
        }
        {hideIndicator ? /* istanbul ignore next */ undefined : <div className="components-triangle" />}
      </button>
      <PopupItemPopup
        isOpen={isPanelShown}
        onClose={handleClose}
        position={toToolbarPopupRelativePosition(expandsToDirection, panelAlignment)}
        target={target}
      >
        {panel}
      </PopupItemPopup>
    </ToolbarPopupContext.Provider>
  );
}

/** @internal */
interface PopupItemPopupProps {
  children?: React.ReactNode;
  isOpen?: boolean;
  onClose(): void;
  position: RelativePosition;
  target?: HTMLElement;
}

/** @internal */
export function PopupItemPopup(props: PopupItemPopupProps) {
  return <Popup
    className="components-toolbar-popupItem_popupItemPopup"
    offset={0}
    showShadow={false}
    {...props}
  />;
}
