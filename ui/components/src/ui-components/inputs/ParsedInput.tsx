/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Inputs
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps, Input } from "@bentley/ui-core";
import { ParseResults, SpecialKey } from "@bentley/ui-abstract";
import "./ParsedInput.scss";

/** Props for [[ParsedInput]] control
 * @beta
 */
export interface ParsedInputProps extends CommonProps {
  /** InitialValue which is used to restore input field if ESC is pressed */
  initialValue: string | number | boolean | {} | string[] | Date | [];  // TODO-should this only support number values?
  /** Function used to format the value */
  formatValue: (value: string | number | boolean | {} | string[] | Date | []) => string;
  /** Function used to parse user input into a value */
  parseString: (stringValue: string) => ParseResults;
  /** Function to call when value is changed */
  onChange?: (newValue: string | number | boolean | {} | string[] | Date | []) => void;
  /** if readonly then only the formatValue function is used. */
  readonly?: boolean;
}

/** Generic Input component that requires formatting and parsing functions to be passed in as props.
 * @beta
 */
export function ParsedInput({ initialValue, formatValue, parseString, readonly, className, style, onChange }: ParsedInputProps) {
  const currentValueRef = React.useRef(initialValue);
  const isMountedRef = React.useRef(false);
  const lastFormattedValueRef = React.useRef(formatValue(initialValue));
  const [formattedValue, setFormattedValue] = React.useState(() => lastFormattedValueRef.current);
  const [hasBadInput, setHasBadInput] = React.useState(false);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    }
  }, [])

  // See if new initialValue props have changed since component mounted
  React.useEffect(() => {
    // istanbul ignore else
    if (initialValue !== currentValueRef) {
      currentValueRef.current = initialValue;
      lastFormattedValueRef.current = formatValue(initialValue);
      setFormattedValue(formatValue(lastFormattedValueRef.current));
      setHasBadInput(false);
    }
  }, [formatValue, initialValue])

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormattedValue(event.currentTarget.value);
  }, [])

  const updateQuantityValueFromString = React.useCallback((strVal: string) => {
    if (lastFormattedValueRef.current === strVal)
      return;

    const parseResults = (parseString(strVal));
    if (!parseResults.parseError) {
      if (undefined !== parseResults.value) {
        if (currentValueRef.current !== parseResults.value) {
          currentValueRef.current = parseResults.value;
          lastFormattedValueRef.current = formatValue(currentValueRef.current);
          onChange && onChange(parseResults.value);
          if (isMountedRef.current) {
            setFormattedValue(lastFormattedValueRef.current);
            setHasBadInput(false);
          }
        }
      }
    } else {
      setHasBadInput(true);
    }
  }, [formatValue, onChange, parseString]);

  const handleOnBlur = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (event.target.value !== lastFormattedValueRef.current)
      updateQuantityValueFromString(event.target.value);
  }, [updateQuantityValueFromString]);

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    // istanbul ignore else
    if (event.key === SpecialKey.Enter) {
      if (event.currentTarget.value !== lastFormattedValueRef.current)
        updateQuantityValueFromString(event.currentTarget.value);
      event.preventDefault();
    }
    if (event.key === SpecialKey.Escape) {
      setFormattedValue(formatValue(currentValueRef.current));
      setHasBadInput(false);
      event.preventDefault();
    }
  }

  const classNames = classnames(className, "components-parsed-input", hasBadInput && "components-parsed-input-has-error");

  return <Input data-testid="components-parsed-input" style={style} className={classNames} onKeyDown={onInputKeyDown} onBlur={handleOnBlur}
    onChange={handleInputChange} value={formattedValue} disabled={readonly} />
}
