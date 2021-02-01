/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CustomQuantityPropEditorSpec, getQuantityTypeKey, IModelApp, isCustomQuantityTypeEntry, QuantityTypeArg } from "@bentley/imodeljs-frontend";
import { FormatProps, UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";
import { Checkbox, CommonProps, Select } from "@bentley/ui-core";
import { FormatPanel } from "./FormatPanel";

/** Properties of [[QuantityFormatPanel]] component.
 * @alpha
 */
export interface QuantityFormatPanelProps extends CommonProps {
  quantityType: QuantityTypeArg;
  onFormatChange?: (format: FormatProps) => void;
  /** props below are to be passed on to FormatPanel */
  showSample?: boolean;
  initialMagnitude?: number;
  enableMinimumProperties?: boolean;
}

// <Input
// id={this.props.id}
// value={context!.values[this.props.id]}
// onChange={(event) => context!.setValues({ [this.props.id]: event.currentTarget.value })}
// className="core-form-input"
// />
// )}
// {this.props.editor!.toLowerCase() === "multilinetextbox" && (
// <Textarea
// id={this.props.id}
// value={context!.values[this.props.id]}
// onChange={(event) => context!.setValues({ [this.props.id]: event.currentTarget.value })}
// className="core-form-textarea"
// />
// )}
// {this.props.editor!.toLowerCase() === "dropdown" && this.props.options && (
// <Select
// id={this.props.id}
// name={this.props.id}
// value={context!.values[this.props.id]}
// onChange={(event) => context!.setValues({ [this.props.id]: event.currentTarget.value })}
// options={this.props.options}
// className="core-form-select"
// />
// )}
// *       editor: "dropdown",
// *       value: "one",
// *       options: ["one", "two", "three", "four"],
//
// editorType: "select",
// selectOptions: [
//   {value: "clockwise", label: IModelApp.i18n.translate("SampleApp:BearingQuantityType.bearingAngleDirection.clockwise") },
//   {value: "counter-clockwise", label: IModelApp.i18n.translate("SampleApp:BearingQuantityType.bearingAngleDirection.counter-clockwise") }
// ],
//

function createSelectFormatPropEditor(label: string, options: {label: string, value: string}[] , inProps: FormatProps,
  getString: (props: FormatProps) => string, setString: (props: FormatProps, value: string) => FormatProps, fireFormatChange: (newProps: FormatProps) => void) {
  const value = getString (inProps);
  return (
    <>
      <span className={"uicore-label"}>{label}</span>
      <Select
        value={value}
        options={options}
        onChange={(e) => {
          const newProps = setString(inProps, e.currentTarget.value);
          fireFormatChange (newProps);
        }}
      />
    </>
  );
}

function createCheckboxFormatPropEditor(label: string, inProps: FormatProps, getBool: (props: FormatProps) => boolean, setBool: (props: FormatProps, isChecked: boolean) => FormatProps, fireFormatChange: (newProps: FormatProps) => void) {
  const isChecked = getBool (inProps);
  return (
    <>
      <span className={"uicore-label"}>{label}</span>
      <Checkbox isLabeled={true} checked={isChecked}
        onChange={(e)=>{
          const newProps = setBool(inProps, e.target.checked);
          fireFormatChange (newProps);
        }} />
    </>
  );
}

/** Component to show/edit Quantity Format.
 * @alpha
 */
export function QuantityFormatPanel(props: QuantityFormatPanelProps) {
  const { quantityType, onFormatChange, ...otherProps } = props;
  const [formatProps, setFormatProps] = React.useState<FormatProps>();
  const [persistenceUnit, setPersistenceUnit] = React.useState(()=>{
    const quantityTypeKey = getQuantityTypeKey(quantityType);
    const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
    return quantityTypeEntry?.persistenceUnit;
  });

  React.useEffect(() => {
    const newFormatProps = IModelApp.quantityFormatter.getFormatPropsByQuantityType(quantityType);
    setFormatProps(newFormatProps);
  }, [quantityType]);

  React.useEffect(() => {
    const quantityTypeKey = getQuantityTypeKey(quantityType);
    const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
    setPersistenceUnit(quantityTypeEntry?.persistenceUnit);
  }, [quantityType]);

  const handleOnFormatChanged = React.useCallback(async (newProps: FormatProps) => {
    setFormatProps(newProps);
    onFormatChange && onFormatChange (newProps);
  }, [onFormatChange]);

  const createCustomPropEditors = React.useCallback( (specs: CustomQuantityPropEditorSpec[], inProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => {
    return specs.map((spec) => {
      switch (spec.editorType) {
        case "checkbox":
          if (spec.getBool  && spec.setBool)
            return createCheckboxFormatPropEditor(spec.label, inProps, spec.getBool, spec.setBool, fireFormatChange);
          break;
        case "select":
          if (spec.getString && spec.setString && spec.selectOptions)
            return createSelectFormatPropEditor(spec.label, spec.selectOptions, inProps, spec.getString, spec.setString, fireFormatChange);
          break;
        case "text":
        default:
          break;
      }
      return <div/>;
    });
  }, []);

  const providePrimaryChildren = React.useCallback(
    (inProps: FormatProps, fireFormatChange: (newProps: FormatProps) => void) => {
      const quantityTypeKey = getQuantityTypeKey(quantityType);
      const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeEntry && isCustomQuantityTypeEntry(quantityTypeEntry)) {
        if (quantityTypeEntry.primaryPropEditorSpecs)
          return createCustomPropEditors (quantityTypeEntry.primaryPropEditorSpecs, inProps, fireFormatChange);
      }
      return null;
    }, [createCustomPropEditors, quantityType]);

  const provideSecondaryChildren = React.useCallback(
    (_inProps: FormatProps, _fireFormatChange: (newProps: FormatProps) => void) => {
      const quantityTypeKey = getQuantityTypeKey(quantityType);
      const quantityTypeEntry = IModelApp.quantityFormatter.quantityTypesRegistry.get(quantityTypeKey);
      if (quantityTypeEntry) {
        // TODO
      }

      return null;
    }, [quantityType]);

  const provideFormatSpec = React.useCallback(
    async (inProps: FormatProps, _persistenceUnit: UnitProps, _unitsProvider: UnitsProvider) => {
      return IModelApp.quantityFormatter.generateFormatterSpecByType(quantityType, inProps);
    }, [quantityType]);

  return (
    <div className="components-quantityFormat-quantityPanel">
      {persistenceUnit && formatProps &&
      <FormatPanel onFormatChange={handleOnFormatChanged} {...otherProps}
        initialFormat={formatProps}
        unitsProvider={IModelApp.quantityFormatter as UnitsProvider}
        persistenceUnit={persistenceUnit}
        providePrimaryChildren={providePrimaryChildren}
        provideSecondaryChildren={provideSecondaryChildren}
        provideFormatSpec={provideFormatSpec}
      /> }
    </div>
  );
}
