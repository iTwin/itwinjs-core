/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { FormatProps } from "@itwin/core-quantity";
import { RelativePosition, SpecialKey } from "@itwin/appui-abstract";
import { Popup, WebFontIcon } from "@itwin/core-react";
import { FormatPanel, FormatPanelProps, UiIModelComponents } from "@itwin/imodel-components-react";
import "./FormatPopupButton.scss";
import { Button } from "@itwin/itwinui-react";

/** Props used by [[FormatPopupButton]] component.
 * @alpha */
export interface FormatPopupButtonProps extends FormatPanelProps {
  /** Function called when Date changes. */
  onFormatChange?: (format: FormatProps) => void;
}

/** Component that displays a button used to pick a date and optionally a time.
 * @alpha
 * */
export function FormatPopupButton(props: FormatPopupButtonProps) {
  const { onFormatChange, ...otherProps } = props;  // extract className and style and forward those to button?
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [showFocusOutline, setShowFocusOutline] = React.useState(false);
  const [formatProps, setFormatProps] = React.useState(props.initialFormat);
  const toolTipLabelRef = React.useRef(UiIModelComponents.translate("QuantityFormat.popupButton.setFormat"));

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const handleCloseSetting = React.useCallback(() => {
    setIsSettingsOpen(false);
  }, [setIsSettingsOpen]);

  const handlePointerDown = React.useCallback((event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    setShowFocusOutline(false);
    setIsSettingsOpen((prev) => !prev);
  }, [setIsSettingsOpen]);

  const handlePopupKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    // istanbul ignore else
    if (event.key === SpecialKey.Space) {
      setShowFocusOutline(true);
      setIsSettingsOpen(true);
    }
  }, []);

  // should popup only call this when a Save or OK button is pressed?
  const handleOnFormatChanged = React.useCallback((format: FormatProps) => {
    setFormatProps(format);
  }, []);

  const handleOnFormatSave = React.useCallback(() => {
    onFormatChange && onFormatChange(formatProps);
    setIsSettingsOpen(false);
  }, [formatProps, onFormatChange]);

  return (
    <>
      <button title={toolTipLabelRef.current} className="components-quantity-format-popup-button" onKeyDown={handlePopupKeyDown}
        data-testid="components-quantity-format-popup-button" onPointerDown={handlePointerDown} ref={buttonRef}>
        <div className="components-down-icon">
          <WebFontIcon iconName="icon-settings" />
        </div>
      </button>
      <Popup
        isOpen={isSettingsOpen}
        position={RelativePosition.BottomLeft}
        onClose={handleCloseSetting}
        target={buttonRef.current}
        closeOnEnter={false}
        moveFocus={showFocusOutline}
      >
        <div className="components-quantity-format-popup-panel" data-testid="components-quantity-format-popup-panel">
          <FormatPanel onFormatChange={handleOnFormatChanged} {...otherProps} enableMinimumProperties />
          <div className="components-button-panel">
            <Button styleType="high-visibility" onClick={handleOnFormatSave}>Save</Button>
          </div>
        </div>
      </Popup>
    </>
  );
}
