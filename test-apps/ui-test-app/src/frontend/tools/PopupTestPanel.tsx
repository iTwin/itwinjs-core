/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DatePickerPopupButton, DatePickerPopupButtonProps } from "@bentley/ui-components";
import { Button } from "@bentley/ui-core";
import { ModalDialogManager, ModelessDialogManager } from "@bentley/ui-framework";
import * as React from "react";
import { SampleModelessDialog } from "../appui/dialogs/SampleModelessDialog";
import { TestModalDialog } from "../appui/dialogs/TestModalDialog";

import { SamplePopupContextMenu } from "../appui/frontstages/component-examples/SamplePopupContextMenu";
import "./PopupTestPanel.scss";

export function DatePickerHost(props: DatePickerPopupButtonProps) {
  const { onDateChange, selected, ...otherProp } = props;
  const [currentDate, setCurrentDate] = React.useState(selected);

  const handleOnDateChange = React.useCallback((day: Date) => {
    onDateChange && onDateChange(day);
    setCurrentDate(day);
  }, [onDateChange]);

  return (
    <DatePickerPopupButton selected={currentDate} onDateChange={handleOnDateChange} {...otherProp} />
  );
}

export function PopupTestPanel() {
  const divRef = React.useRef<HTMLDivElement>(null);

  const handleOpenModalClick = React.useCallback(() => {
    ModalDialogManager.openDialog(<TestModalDialog opened={true} />, "TestModal", divRef.current?.ownerDocument ?? document);
  }, []);

  const handleOpenModelessClick = React.useCallback(() => {
    ModelessDialogManager.openDialog(
      <SampleModelessDialog opened={true} movable={true} dialogId={"SampleModeless"} />, "SampleModeless", divRef.current?.ownerDocument ?? document);
  }, []);

  return (
    <div className="test-popup-test-panel" ref={divRef}>
      <SamplePopupContextMenu />
      <DatePickerHost selected={new Date()} />
      <Button style={{ width: "180px" }} onClick={handleOpenModalClick}>Open Modal</Button>
      <Button style={{ width: "180px" }} onClick={handleOpenModelessClick}>Open Modeless</Button>
    </div>
  );
}
