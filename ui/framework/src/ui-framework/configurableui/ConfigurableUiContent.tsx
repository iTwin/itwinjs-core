/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

import "./configurableui.scss";
import * as React from "react";
import { CommonProps, Point } from "@bentley/ui-core";
import { CursorInformation } from "../cursor/CursorInformation";
import { CursorPopupMenu } from "../cursor/cursormenu/CursorMenu";
import { CursorPopupRenderer } from "../cursor/cursorpopup/CursorPopupManager";
import { ModalDialogRenderer } from "../dialog/ModalDialogManager";
import { ModelessDialogRenderer } from "../dialog/ModelessDialogManager";
import { ElementTooltip } from "../feedback/ElementTooltip";
import { FrontstageComposer } from "../frontstage/FrontstageComposer";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import { KeyboardShortcutMenu } from "../keyboardshortcut/KeyboardShortcutMenu";
import { InputFieldMessage } from "../messages/InputField";
import { PointerMessage } from "../messages/Pointer";
import { PopupRenderer } from "../popup/PopupManager";
import { WidgetPanelsFrontstage } from "../widget-panels/Frontstage";

// cSpell:ignore cursormenu

/** Properties for [[ConfigurableUiContent]]
 * @public
 */
export interface ConfigurableUiContentProps extends CommonProps {
  /** React node of the Backstage */
  appBackstage?: React.ReactNode;
}

/** The ConfigurableUiContent component is the component the pages specified using ConfigurableUi
 * @public
 */
export function ConfigurableUiContent(props: ConfigurableUiContentProps) {
  const version = useFrameworkVersion();
  React.useEffect(() => {
    KeyboardShortcutManager.setFocusToHome();
  }, []);
  React.useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      const element = document.activeElement as HTMLElement;

      if (element === document.body && e.key !== "Escape") {
        KeyboardShortcutManager.processKey(e.key, e.altKey, e.ctrlKey, e.shiftKey);
      }
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    const point = new Point(e.pageX, e.pageY);
    CursorInformation.handleMouseMove(point);
  }, []);

  return (
    <div
      id="uifw-configurableui-wrapper"
      className={props.className}
      style={props.style}
      onMouseMove={handleMouseMove}
    >
      {props.appBackstage}
      {version === "1" ? <FrontstageComposer style={{ position: "relative", height: "100%" }} /> : <WidgetPanelsFrontstage />}
      <ModelessDialogRenderer />
      <ModalDialogRenderer />
      <ElementTooltip />
      <PointerMessage />
      <KeyboardShortcutMenu />
      <InputFieldMessage />
      <CursorPopupMenu />
      <CursorPopupRenderer />
      <PopupRenderer />
    </div>
  );
}
