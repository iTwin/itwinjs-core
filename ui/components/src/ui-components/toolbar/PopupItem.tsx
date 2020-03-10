/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { useOnOutsideClick } from "@bentley/ui-core";
import { useToolbarWithOverflowDirectionContext, useToolItemEntryContext, ToolbarPanelAlignmentHelpers } from "./Toolbar";
import { DirectionHelpers, OrthogonalDirectionHelpers } from "./utilities/Direction";
import { ToolbarButtonItemProps } from "./Item";

import "./PopupItem.scss";
import { ActionButton } from "@bentley/ui-abstract";

/** @internal */
export interface ToolbarPopupContextProps {
  readonly closePanel: () => void;
  readonly setSelectedItem?: (buttonItem: ActionButton) => void;
}

/**
 * Context used by Toolbar items in popups to close the popup panel.
 * @internal
 */
// tslint:disable-next-line: variable-name
export const ToolbarPopupContext = React.createContext<ToolbarPopupContextProps>({
  closePanel: /* istanbul ignore next */ () => { },
  setSelectedItem: /* istanbul ignore next */  (_buttonItem: ActionButton) => { },
});

/** @internal */
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
  // handle open and closing overflow panel
  const onButtonClick = React.useCallback(() => {
    setPanelShown((prev) => !prev);
    // istanbul ignore next
    if (props.onClick)
      props.onClick();
  }, [props]);
  const className = classnames(
    "components-toolbar-button-item",
    "components-toolbar-expandable-button",
    props.isDisabled && "components-disabled",
    props.className);

  const ref = React.useRef<HTMLButtonElement>(null);
  // istanbul ignore next
  const onOutsideClick = React.useCallback(() => {
    setPanelShown(false);
  }, []);
  // istanbul ignore next
  const isOutsideEvent = React.useCallback((e: PointerEvent) => {
    // if clicking on button that open panel - don't trigger outside click processing
    return !!ref.current && (e.target instanceof Node) && !ref.current.contains(e.target);
  }, []);
  const panelRef = useOnOutsideClick<HTMLDivElement>(onOutsideClick, isOutsideEvent);
  const { expandsTo, direction, overflowExpandsTo, overflowDirection, panelAlignment } = useToolbarWithOverflowDirectionContext();
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
      closePanel: () => setPanelShown(false),
    }}>
      <button
        ref={ref}
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
        {props.hideIndicator ? undefined : <div className="components-triangle" />}
      </button>
      {isPanelShown && <div ref={panelRef} className={panelClassName}>{props.panel}</div>}
    </ToolbarPopupContext.Provider>
  );
}
