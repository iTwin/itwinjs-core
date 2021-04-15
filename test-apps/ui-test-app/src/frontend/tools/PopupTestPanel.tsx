/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DatePickerPopupButton, DatePickerPopupButtonProps } from "@bentley/ui-components";
import { Button } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import * as React from "react";
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
  const handleOnClick = React.useCallback(() => {
    ModalDialogManager.openDialog(<TestModalDialog opened={true} />, "TestModal", divRef.current?.ownerDocument ?? document);
  }, []);

  return (
    <div className="test-popup-test-panel" ref={divRef}>
      <SamplePopupContextMenu />
      <DatePickerHost selected={new Date()} />
      <Button style={{ width: "100px" }} onClick={handleOnClick}>Open Modal</Button>
    </div>
  );
}
