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
import { KeyboardShortcutMenu } from "../keyboardshortcut/KeyboardShortcutMenu";
import { InputFieldMessage } from "../messages/InputField";
import { PointerMessage } from "../messages/Pointer";
import { PopupRenderer } from "../popup/PopupManager";
import { WidgetPanelsFrontstage } from "../widget-panels/Frontstage";
import { ContentDialogRenderer } from "../dialog/ContentDialogManager";
import { UiFramework } from "../UiFramework";

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
  const version = useFrameworkVersion(); // eslint-disable-line deprecation/deprecation
  React.useEffect(() => {
    UiFramework.keyboardShortcuts.setFocusToHome();
  }, []);
  React.useEffect(() => {
    UiFramework.controls.activityTracker.initialize({ idleTimeout: props.idleTimeout, intervalTimeout: props.intervalTimeout });
    return () => {
      UiFramework.controls.activityTracker.terminate();
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
      {/* eslint-disable-next-line deprecation/deprecation */}
      {version === "1" ?  /* istanbul ignore next */ <FrontstageComposer style={{ position: "relative", height: "100%" }} /> : /* istanbul ignore next */ <WidgetPanelsFrontstage />}
      <ContentDialogRenderer />
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
