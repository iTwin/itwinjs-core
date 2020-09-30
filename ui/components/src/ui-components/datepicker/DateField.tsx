/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Date
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps, Input } from "@bentley/ui-core";
import { DateFormatter } from "./DatePickerPopupButton";
import "./DateField.scss";

/** Type definition that defines acceptable time formats.
 * @beta
 */
export type TimeDisplay = "hh:mm aa"|"hh:mm:ss aa"|"hh:mm"|"hh:mm:ss";

/** Props for [[DateField]] Component.
 * @alpha
 */
export interface DateFieldProps extends CommonProps {
  /** Defines initial date and time for component. */
  initialDate: Date;
  /** Function to call when the date or time is changed. */
  onDateChange?: (day: Date) => void;
  /** Optional value to define if edit field allows editing. If a DateFormatter is provided
   * it must provide a parseData function or the field will be read only no matter the setting of this value. */
  readOnly?: boolean;
  /** Optional date formatter that produces and explicit date display */
  dateFormatter?: DateFormatter;
  /** This property has two purposes, the first is specify that the display of time is desired and the second is to define the format of the time display. */
  timeDisplay?: TimeDisplay;
}

/** private function to format a Date object. */
function formatInputDate( inputDate: Date, timeDisplay?: TimeDisplay, customFormatter?: DateFormatter): string | undefined {
  if (customFormatter) {
    return customFormatter.formateDate(inputDate)
  }

  const dateString = inputDate.toLocaleDateString(undefined, {day: "2-digit", month: "2-digit", year: "numeric"});
  let timeString: string = "";

  if (timeDisplay) {
    switch (timeDisplay) {
      case "hh:mm aa":
        timeString = inputDate.toLocaleTimeString(undefined, { hour12: true, hour: "2-digit", minute: "2-digit" });
        break;
      case "hh:mm:ss aa":
        timeString = (inputDate.toLocaleTimeString(undefined, { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        break;
      case "hh:mm":
        timeString = (inputDate.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit" }));
        break;
      case "hh:mm:ss":
        timeString = (inputDate.toLocaleTimeString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        break;
    }
  }
  return `${dateString} ${timeString}`
}

/** Date input component. This component is typically used by the [[DatePickerPopupButton]] to display and edit date and time.
 * @internal
 */
export function DateField({initialDate, onDateChange, readOnly, dateFormatter, timeDisplay, style, className}: DateFieldProps) {
  const initialDateRef = React.useRef (initialDate);
  const [date, setDate] = React.useState(initialDate);
  const [hasBadInput, setHasBadInput] = React.useState(false);

  // See if new initialDate props have changed since component mounted
  React.useEffect(() => {
    // istanbul ignore else
    if (initialDate.getTime() !== initialDateRef.current.getTime()) {
      // istanbul ignore else
      if (date.getTime() !== initialDate.getTime()) {
        setDate (initialDate);
        setInputValue (formatInputDate (initialDate, timeDisplay, dateFormatter));
      }
      initialDateRef.current = initialDate;
    }
  }, [initialDate, date, dateFormatter, timeDisplay]);

  const [inputValue, setInputValue] = React.useState(formatInputDate (date, timeDisplay, dateFormatter));

  const handleInputChange = React.useCallback ((event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue (event.currentTarget.value)
  }, [])

  const parseDate = React.useCallback ((dateString: string) => {
    try {
      if (dateFormatter && dateFormatter.parseDate)
        return dateFormatter.parseDate(dateString);

      const newDateValue = Date.parse(dateString);
      // istanbul ignore else
      if (newDateValue)
        return new Date(newDateValue);
    } catch (_error) {
      // istanbul ignore next
      return undefined;
    }
    // istanbul ignore next
    return undefined;
  }, [dateFormatter])

  const updateInputDate  = React.useCallback((dateString: string) => {
    try {
      const newDateValue =parseDate(dateString);
      if (newDateValue) {
        const newDate = new Date(newDateValue);
        onDateChange && onDateChange (newDate);
        setHasBadInput (false);
      } else {
        setHasBadInput (true);
      }
    } catch (_error) {
      // istanbul ignore next
      setHasBadInput (true);
    }
  }, [onDateChange, parseDate]);

  const handleOnBlur = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    updateInputDate (event.target.value)
  }, [updateInputDate]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    // istanbul ignore else
    if (event.key === "Enter") {
      updateInputDate (event.currentTarget.value);
      event.preventDefault();
    }
  }
  const classNames = classnames(className&&className, "components-date-input", hasBadInput&&"has-error");
  return <Input data-testid="components-date-input" style={style} className={classNames} onKeyDown={onInputKeyDown} onBlur={handleOnBlur}
    onChange={handleInputChange} value={inputValue} disabled={readOnly||(dateFormatter && !(dateFormatter.parseDate))} />
}
