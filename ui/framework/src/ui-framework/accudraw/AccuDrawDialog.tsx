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
import { AccuDrawSetFieldValueFromUiEventArgs, AccuDrawUiAdmin } from "@bentley/ui-abstract";
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

  const handleCancel = React.useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const handleEscape = React.useCallback(() => {
    KeyboardShortcutManager.setFocusToHome();
  }, []);

  // DEBUG - remove
  React.useEffect(() => {
    const handleValueFromUi = (args: AccuDrawSetFieldValueFromUiEventArgs) => {
      // eslint-disable-next-line no-console
      console.log(`handleValueFromUi: ${args.field} ${args.value} ${args.stringValue}`);
    };
    return AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.addListener(handleValueFromUi);
  });

  const classNames = classnames("uifw-accudraw-dialog", props.className);

  return (
    <ModelessDialog
      className={classNames} style={props.style}
      title={title.current}
      opened={opened}
      dialogId={props.dialogId}
      width={250}
      movable={true}
      onClose={handleCancel}
      onEscape={handleEscape}
    >
      <AccuDrawFieldContainer orientation={Orientation.Vertical} />
    </ModelessDialog >
  );
};
