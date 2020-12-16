/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import "./AccuDrawInputField.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Icon, IconSpec, NumberInput } from "@bentley/ui-core";
import { isLetter, SpecialKey } from "@bentley/ui-abstract";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Properties for [[AccuDrawInputField]] component
 * @internal
 */
export interface AccuDrawInputFieldProps extends CommonProps {
  /** Initial value */
  initialValue: number;
  /** Indicates whether field is locked */
  lock: boolean;
  /** id for the input element */
  id: string;
  /** label for the input element */
  label?: string;
  /** icon for the input element */
  iconSpec?: IconSpec;
  /** Custom CSS class name for the label */
  labelClassName?: string;
  /** Custom CSS Style for the label */
  labelStyle?: React.CSSProperties;
  /** Triggered when the content is changed */
  onValueChanged: (value: number, stringValue: string) => void;
  /** Frequency to poll for changes in value, in milliseconds */
  valueChangedDelay?: number;
  /** Listens for <Enter> keypress */
  onEnterPressed?: () => void;
  /** Listens for <Esc> keypress */
  onEscPressed?: () => void;
  /** Indicates whether to set focus to the input element */
  setFocus?: boolean;
}

/** Input field for AccuDraw
 * @internal
 */
export function AccuDrawInputField(props: AccuDrawInputFieldProps) {
  const { className, style, id, label, iconSpec, labelClassName, labelStyle, initialValue, lock,
    onValueChanged, valueChangedDelay, onEnterPressed, onEscPressed, setFocus } = props;
  const [numberValue, setNumberValue] = React.useState(initialValue);
  const timeoutId = React.useRef(0);

  React.useEffect(() => {
    setNumberValue(initialValue);
  }, [initialValue]);

  const trackChange = React.useCallback((value: number | undefined, stringValue: string): void => {
    if (value === undefined)
      return;

    if (value !== numberValue)
      setNumberValue(value);

    if (valueChangedDelay) {
      unsetTimeout();
      timeoutId.current = window.setTimeout(() => { onValueChanged(value, stringValue); }, valueChangedDelay);
    } else {
      onValueChanged(value, stringValue);
    }
  }, [onValueChanged, numberValue, valueChangedDelay]);

  const unsetTimeout = (): void => {
    if (timeoutId) {
      window.clearTimeout(timeoutId.current);
      timeoutId.current = 0;
    }
  };

  React.useEffect(() => {
    return () => unsetTimeout();
  }, []);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case SpecialKey.Escape:
        // istanbul ignore else
        if (onEscPressed)
          onEscPressed();
        return;
      case SpecialKey.Enter:
        // istanbul ignore else
        if (onEnterPressed)
          onEnterPressed();
        return;
    }

    if (isLetter(e.key)) {
      KeyboardShortcutManager.processKey(e.key);
      return;
    }
  }, [onEscPressed, onEnterPressed]);

  const inputClassNames = classnames("uifw-accudraw-input-field", className);
  const labelClassNames = classnames("uifw-accudraw-input-label", labelClassName);

  return (
    <>
      <label htmlFor={id} className={labelClassNames} style={labelStyle}>
        {label}
        {iconSpec && <Icon iconSpec={iconSpec} />}
      </label>
      <NumberInput id={id} value={numberValue} precision={4}
        className={inputClassNames} style={style}
        onChange={trackChange} onKeyDown={handleKeyDown} setFocus={setFocus} />
      <span className="uifw-accudraw-lock" >
        {lock && <Icon iconSpec="icon-lock" />}
      </span>
    </>
  );
}
