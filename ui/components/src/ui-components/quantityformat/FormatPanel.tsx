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
import { Checkbox, CommonProps, Input } from "@bentley/ui-core";
import { DecimalPrecision, Format, FormatProps, FormatterSpec, FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { UomSeparatorSelector } from "./UomSeparator";
import { FormatTypeSelector } from "./FormatType";
import { DecimalPrecisionSelector } from "./DecimalPrecision";
import { FractionPrecisionSelector } from "./FractionPrecision";
import { SignOptionSelector } from "./SignOption";
import { ThousandSeparatorSelector } from "./ThousandSeparator";
import { DecimalSeparatorSelector } from "./DecimalSeparator";
import { UnitDescr } from "./UnitDescr";
import { SpecialKey } from "@bentley/ui-abstract";
import { ScientificTypeSelector } from "./ScientificType";

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
}

function getTraitString(trait: FormatTraits) {
  switch (trait) {
    case FormatTraits.KeepSingleZero:
      return "keepSingleZero";
    case FormatTraits.ZeroEmpty:
      return "zeroEmpty";
    case FormatTraits.KeepDecimalPoint:
      return "keepDecimalPoint";
    case FormatTraits.ApplyRounding:
      return "applyRounding";
    case FormatTraits.FractionDash:
      return "fractionDash";
    case FormatTraits.ShowUnitLabel:
      return "showUnitLabel";
    case FormatTraits.PrependUnitLabel:
      return "prependUnitLabel";
    case FormatTraits.Use1000Separator:
      return "use1000Separator";
    case FormatTraits.ExponentOnlyNegative:
      return "exponentOnlyNegative";
  }
  return undefined;
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function FormatPanel(props: FormatPanelProps) {
  const formatSpec = React.useRef<FormatterSpec>();
  const { initialFormat, showSample, initialMagnitude, unitsProvider, persistenceUnit, onFormatChange } = props;
  const [magnitude, setMagnitude] = React.useState(() => initialMagnitude ?? 0);
  const [sampleValue, setSampleValue] = React.useState(magnitude.toString());
  const [formattedValue, setFormattedValue] = React.useState("");
  const [activePersistenceUnitLabel, setActivePersistenceUnitLabel] = React.useState("");
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
    onFormatChange && onFormatChange(newProps);
    // eslint-disable-next-line no-console
    console.log(`FormatProps = ${JSON.stringify(newProps)}`);
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
    if (!formatProps.formatTraits)
      return false;
    const formatTraits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : formatProps.formatTraits.split(/,|;|\|/);
    const traitStr = getTraitString(trait);
    return formatTraits.find((traitEntry) => traitStr === traitEntry) ? true : false;
  }, [formatProps]);

  const handleShowSignChange = React.useCallback((option: ShowSignOption) => {
    const newShowSignOption = Format.showSignOptionToString(option);
    const newFormatProps = { ...formatProps, showSignOption: newShowSignOption };
    setFormatProps(newFormatProps);
  }, [formatProps]);

  const handleUomSeparatorChange = React.useCallback((separator: string) => {
    if (separator.length < 2) {
      const newFormatProps = { ...formatProps, uomSeparator: separator };
      handleSetFormatProps(newFormatProps);
    } else {
      const newFormatProps = { ...formatProps, uomSeparator: initialFormat.uomSeparator };
      handleSetFormatProps(newFormatProps);
    }
  }, [formatProps, initialFormat.uomSeparator, handleSetFormatProps]);

  const handleThousandSeparatorChange = React.useCallback((thousandSeparator: string) => {
    let decimalSeparator = formatProps.decimalSeparator;
    // make sure 1000 and decimal separator do not match
    if (isFormatTraitSet(FormatTraits.Use1000Separator)) {
      if (thousandSeparator === ".")
        decimalSeparator = ",";
      else if (thousandSeparator === ",")
        decimalSeparator = ".";
    }
    const newFormatProps = { ...formatProps, thousandSeparator, decimalSeparator };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, isFormatTraitSet, handleSetFormatProps]);

  const setFormatTrait = React.useCallback((trait: FormatTraits, setActive: boolean) => {
    const traitStr = getTraitString(trait);
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

  const handleUseThousandsSeparatorChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.Use1000Separator, e.target.checked);
  }, [setFormatTrait]);

  const handleShowUnitLabelChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFormatTrait(FormatTraits.ShowUnitLabel, e.target.checked);
  }, [setFormatTrait]);

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

  const handleOnValueBlur = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    let newValue = e.target.value ? Number.parseFloat(e.target.value) : 0;
    if (Number.isNaN(newValue))
      newValue = 0;
    setMagnitude(newValue);
  }, []);

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
      e.preventDefault();
    }
  }, []);

  const handleOnSpacerChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (formatProps.composite) {
      const composite = { ...formatProps.composite, spacer: e.target.value };
      const newFormatProps = { ...formatProps, composite };
      handleSetFormatProps(newFormatProps);
    }
  }, [formatProps, handleSetFormatProps]);

  const handleScientificTypeChange = React.useCallback((type: ScientificType) => {
    const newFormatProps = { ...formatProps, scientificType: Format.scientificTypeToString(type) };
    handleSetFormatProps(newFormatProps);
  }, [formatProps, handleSetFormatProps]);

  React.useEffect(() => {
    async function fetchFormatSpec() {
      const pu = await persistenceUnit;
      setActivePersistenceUnitLabel(pu.label);
      const actualFormat = new Format("custom");
      await actualFormat.fromJSON(unitsProvider, formatProps);
      formatSpec.current = await FormatterSpec.create(actualFormat.name, actualFormat, unitsProvider, pu);
      setFormattedValue(formatSpec.current.applyFormatting(magnitude));
    }
    fetchFormatSpec(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [formatProps, magnitude, persistenceUnit, unitsProvider]);

  const handleUnitLabelChange = React.useCallback((newLabel: string, index: number) => {
    if (formatProps.composite?.units && formatProps.composite.units.length > index && index >= 0) {
      const units = formatProps.composite.units.map((entry, ndx) => {
        if (index === ndx)
          return { name: entry.name, label: newLabel };
        else
          return entry;
      });

      const composite = { ...formatProps.composite, units };
      const newFormatProps = { ...formatProps, composite };
      handleSetFormatProps(newFormatProps);
    }
  }, [formatProps, handleSetFormatProps]);

  const handleUnitChange = React.useCallback((newUnit: string, index: number) => {
    const unitParts = newUnit.split(/:/);
    if (unitParts[0] === "REMOVEUNIT") {
      if (formatProps.composite && formatProps.composite.units.length > 1) {
        const units = [...formatProps.composite.units];
        units.pop();
        const composite = { ...formatProps.composite, units };
        const newFormatProps = { ...formatProps, composite };
        handleSetFormatProps(newFormatProps);
      }
    } else if (unitParts[0] === "ADDSUBUNIT") {
      const units = formatProps.composite?.units && formatProps.composite.units.length ?
        [...formatProps.composite.units, { name: unitParts[1], label: unitParts[2] }] :
        [{ name: unitParts[1], label: unitParts[2] }];
      const composite = { ...formatProps.composite, units };
      const newFormatProps = { ...formatProps, composite };
      handleSetFormatProps(newFormatProps);
    } else {
      if (formatProps.composite?.units && formatProps.composite.units.length > index && index >= 0) {
        const units = formatProps.composite.units.map((entry, ndx) => {
          if (index === ndx)
            return { name: unitParts[0], label: unitParts[1] };
          else
            return entry;
        });
        const composite = { ...formatProps.composite, units };
        const newFormatProps = { ...formatProps, composite };
        handleSetFormatProps(newFormatProps);
      } else if (!formatProps.composite) {
        const composite = { units: [{ name: unitParts[0], label: unitParts[1] }] };
        const newFormatProps = { ...formatProps, composite };
        handleSetFormatProps(newFormatProps);
      }
    }
  }, [formatProps, handleSetFormatProps]);

  const formatType = React.useMemo(() => Format.parseFormatType(formatProps.type, "format"), [formatProps.type]);
  const showSignOption = React.useMemo(() => Format.parseShowSignOption(formatProps.showSignOption ?? "onlyNegative", "format"), [formatProps.showSignOption]);

  return (
    <div className="components-quantityFormat-panel">
      {showSample &&
        <>
          <span className={"uicore-label"}>Sample Value</span>
          <span className="components-inline"><Input value={sampleValue} onChange={handleOnValueChange} onKeyDown={handleKeyDown} onBlur={handleOnValueBlur} />{activePersistenceUnitLabel}</span>
          <span className={"uicore-label"}>Formatted Value</span>
          <span className={"uicore-label"}>{formattedValue}</span>
        </>
      }
      <span className={"uicore-label"}>Label Separator</span>
      <UomSeparatorSelector separator={formatProps.uomSeparator ?? ""} onChange={handleUomSeparatorChange} />

      {(formatProps.composite?.units && formatProps.composite?.units.length > 0)
        ?
        formatProps.composite.units.map((value, index) => <UnitDescr key={value.name} name={value.name}
          label={value.label ?? ""} parentUnitName={index > 0 ? formatProps.composite!.units[index - 1].name : undefined} unitsProvider={unitsProvider} readonly={index < (formatProps.composite!.units.length - 1)} index={index} onUnitChange={handleUnitChange} onLabelChange={handleUnitLabelChange} />)
        :
        formatSpec.current && <UnitDescr key={formatSpec.current.persistenceUnit.name} name={formatSpec.current.persistenceUnit.name}
          label={formatSpec.current?.persistenceUnit.label ?? ""} unitsProvider={unitsProvider} index={0} onUnitChange={handleUnitChange} onLabelChange={handleUnitLabelChange} />
      }

      {(formatProps.composite?.units && formatProps.composite?.units.length > 1) &&
        <>
          <span className={"uicore-label"}>Composite Spacer</span>
          <Input value={formatProps.composite?.spacer ?? ""} onChange={handleOnSpacerChange} />
        </>
      }
      <span className={"uicore-label"}>Type</span>
      <FormatTypeSelector type={formatType} onChange={handleFormatTypeChange} />
      <span className={"uicore-label"}>Accuracy</span>
      {formatType === FormatType.Fractional ?
        <FractionPrecisionSelector precision={formatProps.precision ?? 0} onChange={handlePrecisionChange} /> :
        <DecimalPrecisionSelector precision={formatProps.precision ?? 0} onChange={handlePrecisionChange} />
      }
      <span className={"uicore-label"}>Sign Option</span>
      <SignOptionSelector signOption={showSignOption} onChange={handleShowSignChange} />
      <span className={"uicore-label"}>Use Thousand Separator</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.Use1000Separator)} onChange={handleUseThousandsSeparatorChange} />
      <span className={classnames("uicore-label", !(isFormatTraitSet(FormatTraits.Use1000Separator)) && "uicore-disabled")}>Thousand Separator</span>
      <ThousandSeparatorSelector separator={formatProps.thousandSeparator ?? ","} disabled={!isFormatTraitSet(FormatTraits.Use1000Separator)} onChange={handleThousandSeparatorChange} />
      <span className={"uicore-label"}>Decimal Separator</span>
      <DecimalSeparatorSelector separator={formatProps.decimalSeparator ?? "."} onChange={handleDecimalSeparatorChange} />
      <span className={"uicore-label"}>Append Unit Label</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.ShowUnitLabel)} onChange={handleShowUnitLabelChange} />
      <span className={"uicore-label"}>Show Trailing Zeros</span>
      <Checkbox isLabeled={true} checked={isFormatTraitSet(FormatTraits.TrailZeroes)} onChange={handleShowTrailingZeroesChange} />
      <span className={"uicore-label"}>Keep Decimal Point</span>
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
