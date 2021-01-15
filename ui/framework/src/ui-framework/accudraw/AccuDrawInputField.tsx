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
import { CommonProps, Icon, IconSpec, Input } from "@bentley/ui-core";
import { isLetter, SpecialKey } from "@bentley/ui-abstract";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Properties for [[AccuDrawInputField]] component
 * @internal
 */
export interface AccuDrawInputFieldProps extends CommonProps {
  /** String value */
  initialValue: string;
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
  onValueChanged: (stringValue: string) => void;
  /** Frequency to poll for changes in value, in milliseconds */
  valueChangedDelay?: number;
  /** Listens for <Enter> keypress */
  onEnterPressed?: () => void;
  /** Listens for <Esc> keypress */
  onEscPressed?: () => void;
  /** Provides ability to return reference to HTMLInputElement */
  ref?: React.Ref<HTMLInputElement>;
}

const ForwardRefParsedInput = React.forwardRef<HTMLInputElement, AccuDrawInputFieldProps>(
  function ForwardRefAccuDrawInputField(props: AccuDrawInputFieldProps, ref) {
    const { className, style, id, label, iconSpec, labelClassName, labelStyle, initialValue, lock,
      onValueChanged, valueChangedDelay, onEnterPressed, onEscPressed } = props;
    const [stringValue, setStringValue] = React.useState(initialValue);
    const timeoutId = React.useRef(0);

    React.useEffect(() => {
      setStringValue(initialValue);
    }, [initialValue]);

    const trackChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
      const value = event.target.value;

      // istanbul ignore next
      if (value === undefined)
        return;

      // istanbul ignore else
      if (value !== stringValue)
        setStringValue(value);

      if (valueChangedDelay) {
        unsetTimeout();
        timeoutId.current = window.setTimeout(() => { onValueChanged(stringValue); }, valueChangedDelay);
      } else {
        onValueChanged(stringValue);
      }
    }, [onValueChanged, stringValue, valueChangedDelay]);

    const unsetTimeout = (): void => {
      // istanbul ignore else
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
          onEscPressed && onEscPressed();
          return;
        case SpecialKey.Enter:
          onEnterPressed && onEnterPressed();
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
        <Input ref={ref} id={id} value={stringValue}
          className={inputClassNames} style={style}
          onChange={trackChange} onInput={trackChange} onKeyDown={handleKeyDown} />
        <span className="uifw-accudraw-lock" >
          {lock && <Icon iconSpec="icon-lock" />}
        </span>
      </>
    );
  }
);

/** Input field for AccuDraw
 * @internal
 */
export const AccuDrawInputField: (props: AccuDrawInputFieldProps) => JSX.Element | null = ForwardRefParsedInput;
