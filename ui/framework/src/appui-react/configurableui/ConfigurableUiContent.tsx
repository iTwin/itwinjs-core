/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ConfigurableUi
 */

import "./configurableui.scss";
import * as React from "react";
import { CommonProps, Point } from "@itwin/core-react";
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
import { ConfigurableUiManager } from "./ConfigurableUiManager";

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
