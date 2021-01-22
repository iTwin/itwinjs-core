/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import "./FormatPanel.scss";
import classnames from "classnames";
import * as React from "react";
import { Checkbox, CommonProps } from "@bentley/ui-core";
import { DecimalPrecision, Format, FormatProps, FormatterSpec, FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { FormatTypeSelector } from "./FormatType";
import { DecimalPrecisionSelector } from "./DecimalPrecision";
import { FractionPrecisionSelector } from "./FractionPrecision";
import { SignOptionSelector } from "./SignOption";
import { ThousandsSeparator } from "./ThousandsSeparator";
import { DecimalSeparatorSelector } from "./DecimalSeparator";
import { FormatSample } from "./FormatSample";
import { ScientificTypeSelector } from "./ScientificType";
import { FormatUnits } from "./FormatUnits";
import { FormatUnitLabel } from "./FormatUnitLabel";

/** Properties of [[UomSeparatorSelector]] component.
 * @alpha
 */
export interface FormatPanelProps extends CommonProps {
  initialFormat: FormatProps;
  unitsProvider: UnitsProvider;
  persistenceUnit: Promise<UnitProps> | UnitProps;
  showSample?: boolean;
  initialMagnitude?: number;
  onFormatChange?: (format: FormatProps) => void;
  formatSpecFactory?: (persistenceUnit: UnitProps, formatProps: FormatProps, unitsProvider: UnitsProvider) => Promise<FormatterSpec>;
}

async function generateFormatSpec(persistenceUnit: UnitProps, formatProps: FormatProps, unitsProvider: UnitsProvider) {
  const actualFormat = new Format("custom");
  await actualFormat.fromJSON(unitsProvider, formatProps);
  return FormatterSpec.create(actualFormat.name, actualFormat, unitsProvider, persistenceUnit);
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function FormatPanel(props: FormatPanelProps) {
  const [formatSpec, setFormatSpec] = React.useState<FormatterSpec>();
  const { initialFormat, showSample, initialMagnitude, unitsProvider, persistenceUnit, onFormatChange, formatSpecFactory } = props;
  const [formatProps, setFormatProps] = React.useState(initialFormat);
  const initialFormatRef = React.useRef<FormatProps>(initialFormat);

  React.useEffect(() => {
    if (initialFormatRef.current !== initialFormat) {
      initialFormatRef.current = initialFormat;
      setFormatProps(initialFormat);
    }
  }, [initialFormat]);

  const handleSetFormatProps = React.useCallback((newProps: FormatProps) => {
    setFormatProps(newProps);
    setFormatSpec(undefined); // this will trigger the new spec to be created in the useEffect hook
    onFormatChange && onFormatChange(newProps);
    // console.log(`FormatProps = ${JSON.stringify(newProps)}`); // eslint-disable-line no-console
  }, [onFormatChange]);

  const handlePrecisionChange = React.useCallback((precision: number) => {
    const newFormatProps = { ...formatProps, precision };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const handleFormatTypeChange = React.useCallback((newType: FormatType) => {
    const type = Format.formatTypeToString(newType);
    let precision: number | undefined;
    let scientificType: string | undefined;
    switch (newType) { // type must be decimal, fractional, scientific, or station
      case FormatType.Scientific:
        precision = DecimalPrecision.Six;
        scientificType = Format.scientificTypeToString(ScientificType.Normalized);
        break;
      case FormatType.Decimal:
      case FormatType.Station:
        precision = DecimalPrecision.Six;
        break;
      case FormatType.Fractional:
        precision = FractionalPrecision.Eight;
        break;
    }
    const newFormatProps = { ...formatProps, type, precision, scientificType };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const isFormatTraitSet = React.useCallback((trait: FormatTraits) => {
    return Format.isFormatTraitSetInProps(formatProps, trait);
  }, [formatProps]);

  const handleShowSignChange = React.useCallback((option: ShowSignOption) => {
    const newShowSignOption = Format.showSignOptionToString(option);
    const newFormatProps = { ...formatProps, showSignOption: newShowSignOption };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const setFormatTrait = React.useCallback((trait: FormatTraits, setActive: boolean) => {
    const traitStr = Format.getTraitString(trait);
    if (undefined === traitStr)
      return;
    let formatTraits: string[] | undefined;

    if (setActive) {
      // setting trait
      if (!formatProps.formatTraits) {
        formatTraits = [traitStr];
      } else {
        const traits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : formatProps.formatTraits.split(/,|;|\|/);
        if (!traits.find((traitEntry) => traitStr === traitEntry)) {
          formatTraits = [...traits, traitStr];
        }
      }
    } else {
      // clearing trait
      if (!formatProps.formatTraits)
        return;
      const traits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : formatProps.formatTraits.split(/,|;|\|/);
      formatTraits = traits.filter((traitEntry) => traitEntry !== traitStr);
    }
    const newFormatProps = { ...formatProps, formatTraits };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  const handleShowTrailingZeroesChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.TrailZeroes, e.target.checked);
  }, [setFormatTrait]);

  const handleKeepDecimalPointChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.KeepDecimalPoint, e.target.checked);
  }, [setFormatTrait]);

  const handleKeepSingleZeroChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.KeepSingleZero, e.target.checked);
  }, [setFormatTrait]);

  const handleZeroEmptyChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.ZeroEmpty, e.target.checked);
  }, [setFormatTrait]);

  const handleUseFractionDashChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.FractionDash, e.target.checked);
  }, [setFormatTrait]);

  const handleDecimalSeparatorChange = React.useCallback((decimalSeparator: string) => {
    let thousandSeparator = formatProps.thousandSeparator;
    // make sure 1000 and decimal separator do not match
    if (isFormatTraitSet(FormatTraits.Use1000Separator)) {
      if (decimalSeparator === ".")
        thousandSeparator = ",";
      else if (decimalSeparator === ",")
        thousandSeparator = ".";
    }
    const newFormatProps = { ...formatProps, thousandSeparator, decimalSeparator };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, isFormatTraitSet, handleSetFormatProps]);

  const handleScientificTypeChange = React.useCallback((type: ScientificType) => {
    const newFormatProps = { ...formatProps, scientificType: Format.scientificTypeToString(type) };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  React.useEffect(() => {
    async function fetchFormatSpec() {
      const pu = await persistenceUnit;
      let newFormatSpec: FormatterSpec;
      if (formatSpecFactory) {
        newFormatSpec = await formatSpecFactory(pu, formatProps, unitsProvider);
      } else {
        newFormatSpec = await generateFormatSpec(pu, formatProps, unitsProvider);
      }
      setFormatSpec(newFormatSpec);
    }
    if (!formatSpec)
      fetchFormatSpec(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [formatProps, formatSpec, formatSpecFactory, persistenceUnit, unitsProvider]);

  const handleFormatChange = React.useCallback((newFormatProps: FormatProps) => {
    handleSetFormatProps(newFormatProps);
  }, [handleSetFormatProps]);

  const formatType = React.useMemo(() => Format.parseFormatType(formatProps.type, "format"), [formatProps.type]);
  const showSignOption = React.useMemo(() => Format.parseShowSignOption(formatProps.showSignOption ?? "onlyNegative", "format"), [formatProps.showSignOption]);

  return (
    <div className="components-quantityFormat-panel">
      {showSample && <FormatSample formatSpec={formatSpec} initialMagnitude={initialMagnitude} />}

      <FormatUnits unitsProvider={unitsProvider} persistenceUnit={formatSpec?.persistenceUnit} initialFormat={formatProps} onUnitsChange={handleFormatChange} />

      <FormatUnitLabel formatProps={formatProps} onUnitLabelChange={handleFormatChange} />

      <span className={"uicore-label"}>Accuracy</span>
      {formatType === FormatType.Fractional ?
        <FractionPrecisionSelector precision={formatProps.precision ?? 0} onChange={handlePrecisionChange} /> :
        <DecimalPrecisionSelector precision={formatProps.precision ?? 0} onChange={handlePrecisionChange} />
      }
      <span className={"uicore-label"}>Sign Option</span>
      <SignOptionSelector signOption={showSignOption} onChange={handleShowSignChange} />

      <ThousandsSeparator formatProps={formatProps} onChange={handleFormatChange} />

      <span className={"uicore-label"}>Type</span>
      <FormatTypeSelector type={formatType} onChange={handleFormatTypeChange} />

      <span className={classnames("uicore-label", formatType === FormatType.Fractional && "uicore-disabled")}>Decimal Separator</span>
      <DecimalSeparatorSelector separator={formatProps.decimalSeparator ?? "."} onChange={handleDecimalSeparatorChange} disabled={formatType === FormatType.Fractional} />

      <span className={"uicore-label"}>Show Trailing Zeros</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.TrailZeroes)} onChange={handleShowTrailingZeroesChange} />

      <span className={classnames("uicore-label", formatType === FormatType.Fractional && "uicore-disabled")} >Keep Decimal Point</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.KeepDecimalPoint)} onChange={handleKeepDecimalPointChange} />

      <span className={"uicore-label"}>Keep Single Zero</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.KeepSingleZero)} onChange={handleKeepSingleZeroChange} />

      <span className={"uicore-label"}>Zero Empty</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.ZeroEmpty)} onChange={handleZeroEmptyChange} />

      <span className={classnames("uicore-label", formatType !== FormatType.Fractional && "uicore-disabled")}>Fraction Dash</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.FractionDash)} onChange={handleUseFractionDashChange} disabled={formatType !== FormatType.Fractional} />

      <span className={classnames("uicore-label", formatType !== FormatType.Scientific && "uicore-disabled")}>Scientific Type</span>
      <ScientificTypeSelector type={(formatProps.scientificType && formatProps.scientificType.length > 0) ? Format.parseScientificType(formatProps.scientificType, "custom") : ScientificType.Normalized}
        disabled={formatType !== FormatType.Scientific} onChange={handleScientificTypeChange} />
    </div>
  );
}
