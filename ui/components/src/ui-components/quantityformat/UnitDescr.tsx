/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module QuantityFormat
 */

import * as React from "react";
import { CommonProps, Input, Select, SelectOption } from "@bentley/ui-core";
import { UnitProps, UnitsProvider } from "@bentley/imodeljs-quantity";

/** Properties of [[UnitDescr]] component.
 * @alpha
 */
export interface UnitDescrProps extends CommonProps {
  name: string;
  parentUnitName?: string;
  label: string;
  index: number;
  unitsProvider: UnitsProvider;
  readonly?: boolean;
  onUnitChange: (value: string, index: number) => void;
  onLabelChange: (value: string, index: number) => void;
}

async function getPossibleUnits(parentUnit: UnitProps, unitsProvider: UnitsProvider, ensureCompatibleComposite: boolean): Promise<UnitProps[]> {
  const unitFamily = parentUnit.unitFamily;
  const possibleUnits = await unitsProvider.getUnitsByFamily(unitFamily);
  if (!ensureCompatibleComposite)
    return possibleUnits;

  const conversionPromises = possibleUnits.map(async (unit) => unitsProvider.getConversion(unit, parentUnit));
  const conversions = await Promise.all(conversionPromises);
  return possibleUnits.filter((unit, index) => ((unit.system === parentUnit.system) && (conversions[index].factor < 1))); // && Number.isInteger(conversions[index].factor)
}

function getUnitName(fullUnitName: string) {
  const nameParts = fullUnitName.split(/[.:]/);
  if (nameParts.length > 0)
    return nameParts[nameParts.length - 1];
  throw Error("Bad unit name encountered");
}

/** Component use to set Quantity Format thousand group separator.
 * @alpha
 */
export function UnitDescr(props: UnitDescrProps) {
  const { name, label, parentUnitName, index, onUnitChange, onLabelChange, readonly, unitsProvider } = props;
  const [unitOptions, setUnitOptions] = React.useState<SelectOption[]>([{ value: name, label: getUnitName(name) }]);
  const [currentUnit, setCurrentUnit] = React.useState({ name, label });

  React.useEffect(() => {
    async function fetchAllowableUnitSelections() {
      const currentUnitProps = await unitsProvider.findUnitByName(name);
      const parentUnit = await unitsProvider.findUnitByName(parentUnitName ? parentUnitName : name);
      if (parentUnit && currentUnitProps) {
        let potentialSubUnit: UnitProps | undefined;
        const potentialUnits = await getPossibleUnits(parentUnit, unitsProvider, index !== 0);
        if (index < 3) {
          const potentialSubUnits = await getPossibleUnits(currentUnitProps, unitsProvider, true);
          if (potentialSubUnits.length)
            potentialSubUnit = potentialSubUnits[0];
        }

        const options = (potentialUnits.length > 0) ?
          potentialUnits.map((unitValue) => {
            return { value: `${unitValue.name}:${unitValue.label}`, label: getUnitName(unitValue.name) };
          }).sort((a, b) => a.label.localeCompare(b.label))
          :
          [{ value: `${currentUnitProps.name}:${currentUnitProps.label}`, label: getUnitName(name) }];

        if (potentialSubUnit) {
          // construct an entry that will provide the name and label of the unit to add
          options.push({ value: `ADDSUBUNIT:${potentialSubUnit.name}:${potentialSubUnit.label}`, label: "Add sub-unit" });
        }

        if (index !== 0)
          options.push({ value: "REMOVEUNIT", label: "Remove" });
        setUnitOptions(options);
        setCurrentUnit(currentUnitProps);
      }
    }
    fetchAllowableUnitSelections(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [index, label, name, parentUnitName, unitsProvider]);

  const handleOnUnitChange = React.useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    onUnitChange && onUnitChange(e.target.value, index);
  }, [index, onUnitChange]);

  const handleOnLabelChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    onLabelChange && onLabelChange(e.target.value, index);
  }, [index, onLabelChange]);

  return (
    <>
      <Select options={unitOptions} value={`${currentUnit.name}:${currentUnit.label}`} onChange={handleOnUnitChange} disabled={readonly} />
      <Input value={label} onChange={handleOnLabelChange} disabled={readonly} />
    </>
  );
}
