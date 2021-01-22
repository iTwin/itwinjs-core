/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CommonProps, Input } from "@bentley/ui-core";
import { FormatterSpec } from "@bentley/imodeljs-quantity";
import { SpecialKey } from "@bentley/ui-abstract";

/** Properties of [[UomSeparatorSelector]] component.
 * @alpha
 */
export interface FormatSampleProps extends CommonProps {
  formatSpec?: FormatterSpec;
  initialMagnitude?: number;
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function FormatSample(props: FormatSampleProps) {
  const { initialMagnitude, formatSpec } = props;
  const initialFormatSpecRef = React.useRef(formatSpec);
  const initialMagnitudeRef = React.useRef(initialMagnitude ?? 0);
  const [magnitude, setMagnitude] = React.useState(initialMagnitudeRef.current);
  const [sampleValue, setSampleValue] = React.useState(magnitude.toString());
  const [formattedValue, setFormattedValue] = React.useState(formatSpec ? formatSpec.applyFormatting(magnitude) : "");

  React.useEffect(() => {
    if ((initialFormatSpecRef.current !== formatSpec) || (initialMagnitudeRef.current !== initialMagnitude)) {
      initialFormatSpecRef.current = formatSpec;
      initialMagnitudeRef.current = initialMagnitude ?? 0;
      setFormattedValue(formatSpec ? formatSpec.applyFormatting(initialMagnitudeRef.current) : "");
      setMagnitude(initialMagnitudeRef.current);
    }
  }, [formatSpec, initialMagnitude]);

  const handleOnValueBlur = React.useCallback(() => {
    let newValue = Number.parseFloat(sampleValue);
    if (Number.isNaN(newValue)) {
      newValue = 0;
    }
    setMagnitude(newValue);
    setSampleValue(newValue.toString());
  }, [sampleValue]);

  const handleOnValueChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSampleValue(event.target.value);
  }, []);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // istanbul ignore else
    if (e.key === SpecialKey.Enter) {
      let newValue = e.currentTarget.value ? Number.parseFloat(e.currentTarget.value) : 0;
      if (Number.isNaN(newValue))
        newValue = 0;
      setMagnitude(newValue);
      setSampleValue(newValue.toString());
      e.preventDefault();
    }
  }, []);

  const activePersistenceUnitLabel = formatSpec ? formatSpec.persistenceUnit.label : "";
  return (
    <>
      <span className={"uicore-label"}>Persisted Value</span>
      <span className="components-inline">
        <Input value={sampleValue} onChange={handleOnValueChange} onKeyDown={handleKeyDown} onBlur={handleOnValueBlur} />{activePersistenceUnitLabel}
      </span>
      <span className={"uicore-label"}>Formatted Value</span>
      <span className={"uicore-label"}>{formattedValue}</span>
    </>
  );
}
