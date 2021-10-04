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
import { CommonProps, Orientation } from "@itwin/core-react";
import { UiFramework } from "../UiFramework";
import { ModelessDialog } from "../dialog/ModelessDialog";
import { AccuDrawFieldContainer } from "./AccuDrawFieldContainer";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Properties for [[AccuDrawDialog]]
 * @beta */
export interface AccuDrawDialogProps extends CommonProps {
  /** Indicates whether the dialog is open */
  opened: boolean;
  /** Unique id for the dialog */
  dialogId: string;
  /** Orientation of the fields */
  orientation?: Orientation;
  /** Callback for when the dialog closes */
  onClose?: () => void;
}

/** Dialog displays [[AccuDrawFieldContainer]] for AccuDraw Ui
 * @beta */
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
  const orientation = (props.orientation !== undefined) ? props.orientation : Orientation.Vertical;
  const dialogWidth = (orientation === Orientation.Horizontal) ? 500 : 250;

  return (
    <ModelessDialog
      className={classNames} style={props.style}
      title={title.current}
      opened={opened}
      dialogId={props.dialogId}
      width={dialogWidth}
      minHeight={75}
      inset={false}
      movable={true}
      onClose={handleClose}
      onEscape={handleEscape}
    >
      <AccuDrawFieldContainer orientation={orientation} />
    </ModelessDialog >
  );
}
