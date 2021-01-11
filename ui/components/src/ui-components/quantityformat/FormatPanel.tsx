/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import "./FormatPanel.scss";
import * as React from "react";
import { Checkbox, CommonProps } from "@bentley/ui-core";
import { Format, FormatProps, FormatTraits, FormatType } from "@bentley/imodeljs-quantity";
import { UomSeparatorSelector } from "./UomSeparator";
import { FormatTypeSelector } from "./FormatType";
import { DecimalPrecisionSelector } from "./DecimalPrecision";
import { FractionPrecisionSelector } from "./FractionPrecision";
import { SignOptionSelector } from "./SignOption";
import { ThousandSeparatorSelector } from "./ThousandSeparator";
import classnames from "classnames";
import { DecimalSeparatorSelector } from "./DecimalSeparator";
import { UnitDescr } from "./UnitDescr";

/** Properties of [[UomSeparatorSelector]] component.
 * @alpha
 */
export interface FormatPanelProps extends CommonProps {
  format: FormatProps;
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function FormatPanel(props: FormatPanelProps) {
  const { format } = props;

  const handleSeparatorChange = React.useCallback(() => {
  }, []);

  const handleFormatTypeChange = React.useCallback(() => {
  }, []);

  const formatType = Format.parseFormatType(format.type, "format");
  const showSignOption = Format.parseShowSignOption(format.showSignOption ?? "onlyNegative", "format");
  const decimalSeparator = format.decimalSeparator ?? ".";
  const traits = Format.parseFormatTraits(format.formatTraits);
  const use1000separator = traits && ((traits & FormatTraits.Use1000Separator) > 0);
  const appendUnitLabel = traits && ((traits & FormatTraits.ShowUnitLabel) > 0);
  const showTrailingZeros = traits && ((traits & FormatTraits.TrailZeroes) > 0);
  const keepDecimalPoint = traits && ((traits & FormatTraits.KeepDecimalPoint) > 0);
  const keepSingleZero = traits && ((traits & FormatTraits.KeepSingleZero) > 0);
  const zeroEmpty = traits && ((traits & FormatTraits.ZeroEmpty) > 0);
  const fractionDash = traits && ((traits & FormatTraits.FractionDash) > 0);
  const exponentOnlyNegative = traits && ((traits & FormatTraits.ExponentOnlyNegative) > 0);

  const handleUseSeparatorChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    // if (e.target.value !== undefined && typeof e.target.value === "boolean")
    //   use1000separator = e.target.value;
  }, []);

  const handleDecimalSeparatorChange = React.useCallback((_value: string) => {
    // if (e.target.value !== undefined && typeof e.target.value === "boolean")
    //   use1000separator = e.target.value;
  }, []);

  const handleUnitLabelChange = React.useCallback((_value: string, _index: number) => {
    // if (e.target.value !== undefined && typeof e.target.value === "boolean")
    //   use1000separator = e.target.value;
  }, []);

  // format.composite?.units
  return (
    <div className="components-quantityFormat-panel">
      {(format.composite?.units && format.composite?.units.length > 0) &&
        format.composite.units.map((value, index) => <UnitDescr key={value.name} name={value.name}
          label={value.label ?? ""} index={index} onChange={handleUnitLabelChange} />)
      }
      <span className={"uicore-label"}>Separator</span>
      <UomSeparatorSelector separator={format.uomSeparator ?? ""} onChange={handleSeparatorChange} />
      <span className={"uicore-label"}>Type</span>
      <FormatTypeSelector type={formatType} onChange={handleFormatTypeChange} />
      <span className={"uicore-label"}>Accuracy</span>
      {formatType === FormatType.Fractional ?
        <FractionPrecisionSelector precision={format.precision ?? 0} onChange={handleFormatTypeChange} /> :
        <DecimalPrecisionSelector precision={format.precision ?? 0} onChange={handleFormatTypeChange} />
      }
      <span className={"uicore-label"}>Sign Option</span>
      <SignOptionSelector signOption={showSignOption} onChange={handleFormatTypeChange} />
      <span className={"uicore-label"}>Use Thousand Separator</span>
      <Checkbox isLabeled={true} checked={use1000separator} onChange={handleUseSeparatorChange} />
      <span className={classnames("uicore-label", !use1000separator && "uicore-disabled")}>Thousand Separator</span>
      <ThousandSeparatorSelector separator={format.thousandSeparator ?? ","} disabled={!use1000separator} onChange={handleSeparatorChange} />
      <span className={"uicore-label"}>Decimal Separator</span>
      <DecimalSeparatorSelector separator={decimalSeparator} onChange={handleDecimalSeparatorChange} />
      <span className={"uicore-label"}>Append Unit Label</span>
      <Checkbox isLabeled={true} checked={appendUnitLabel} onChange={handleUseSeparatorChange} />
      <span className={"uicore-label"}>Show Trailing Zeros</span>
      <Checkbox isLabeled={true} checked={showTrailingZeros} onChange={handleUseSeparatorChange} />
      <span className={"uicore-label"}>Keep Decimal Point</span>
      <Checkbox isLabeled={true} checked={keepDecimalPoint} onChange={handleUseSeparatorChange} />
      <span className={"uicore-label"}>Keep Single Zero</span>
      <Checkbox isLabeled={true} checked={keepSingleZero} onChange={handleUseSeparatorChange} />
      <span className={"uicore-label"}>Zero Empty</span>
      <Checkbox isLabeled={true} checked={zeroEmpty} onChange={handleUseSeparatorChange} />
      <span className={classnames("uicore-label", formatType !== FormatType.Fractional && "uicore-disabled")}>Fraction Dash</span>
      <Checkbox isLabeled={true} checked={fractionDash} onChange={handleUseSeparatorChange} disabled={formatType !== FormatType.Fractional} />
      <span className={classnames("uicore-label", formatType !== FormatType.Scientific && "uicore-disabled")}>Exponent Only Negative</span>
      <Checkbox isLabeled={true} checked={exponentOnlyNegative} onChange={handleUseSeparatorChange} disabled={formatType !== FormatType.Scientific} />
    </div>
  );
}
