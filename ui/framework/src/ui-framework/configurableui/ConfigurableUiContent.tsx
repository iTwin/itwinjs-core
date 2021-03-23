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
import { CursorInformation } from "../cursor/CursorInformation.js";
import { CursorPopupMenu } from "../cursor/cursormenu/CursorMenu.js";
import { CursorPopupRenderer } from "../cursor/cursorpopup/CursorPopupManager.js";
import { ModalDialogRenderer } from "../dialog/ModalDialogManager.js";
import { ModelessDialogRenderer } from "../dialog/ModelessDialogManager.js";
import { ElementTooltip } from "../feedback/ElementTooltip.js";
import { FrontstageComposer } from "../frontstage/FrontstageComposer.js";
import { useFrameworkVersion } from "../hooks/useFrameworkVersion.js";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut.js";
import { KeyboardShortcutMenu } from "../keyboardshortcut/KeyboardShortcutMenu.js";
import { InputFieldMessage } from "../messages/InputField.js";
import { PointerMessage } from "../messages/Pointer.js";
import { PopupRenderer } from "../popup/PopupManager.js";
import { WidgetPanelsFrontstage } from "../widget-panels/Frontstage.js";
import { ConfigurableUiManager } from "./ConfigurableUiManager.js";

// cSpell:ignore cursormenu cursorpopup

/** Properties for [[ConfigurableUiContent]]
 * @public
 */
export interface ConfigurableUiContentProps extends CommonProps {
  /** React node of the Backstage */
  appBackstage?: React.ReactNode;

  /** @internal */
  idleTimeout?: number;
  /** @internal */
  intervalTimeout?: number;
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
    ConfigurableUiManager.activityTracker.initialize({ idleTimeout: props.idleTimeout, intervalTimeout: props.intervalTimeout });
    return () => {
      ConfigurableUiManager.activityTracker.terminate();
    };
  }, [props.idleTimeout, props.intervalTimeout]);

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    const point = new Point(e.pageX, e.pageY);
    CursorInformation.handleMouseMove(point);
  }, []);

  return (
    <main role="main"
      id="uifw-configurableui-wrapper"
      className={props.className}
      style={props.style}
      onMouseMove={handleMouseMove}
    >
      {props.appBackstage}
      {version === "1" ? <FrontstageComposer style={{ position: "relative", height: "100%" }} /> : /* istanbul ignore next */ <WidgetPanelsFrontstage />}
      <ModelessDialogRenderer />
      <ModalDialogRenderer />
      <ElementTooltip />
      <PointerMessage />
      <KeyboardShortcutMenu />
      <InputFieldMessage />
      <CursorPopupMenu />
      <CursorPopupRenderer />
      <PopupRenderer />
    </main>
  );
}
