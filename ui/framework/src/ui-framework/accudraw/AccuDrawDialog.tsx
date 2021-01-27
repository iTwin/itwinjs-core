/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import "./AccuDrawDialog.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Orientation } from "@bentley/ui-core";
import { UiFramework } from "../UiFramework";
import { ModelessDialog } from "../dialog/ModelessDialog";
import { AccuDrawFieldContainer } from "./AccuDrawFieldContainer";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** @alpha */
export interface AccuDrawDialogProps extends CommonProps {
  opened: boolean;
  dialogId: string;
  onClose?: () => void;
}

/** @alpha */
export function AccuDrawDialog(props: AccuDrawDialogProps) {
  const title = React.useRef(UiFramework.translate("accuDraw.dialogTitle"));
  const [opened, setOpened] = React.useState(props.opened);

  const closeDialog = React.useCallback(() => {
    setOpened(false);
    props.onClose && props.onClose();
  }, [props]);

  const handleClose = React.useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const handleEscape = React.useCallback(() => {
    KeyboardShortcutManager.setFocusToHome();
  }, []);

  const classNames = classnames("uifw-accudraw-dialog", props.className);

  return (
    <ModelessDialog
      className={classNames} style={props.style}
      title={title.current}
      opened={opened}
      dialogId={props.dialogId}
      width={250}
      movable={true}
      onClose={handleClose}
      onEscape={handleEscape}
    >
      <AccuDrawFieldContainer orientation={Orientation.Vertical} />
    </ModelessDialog >
  );
}
