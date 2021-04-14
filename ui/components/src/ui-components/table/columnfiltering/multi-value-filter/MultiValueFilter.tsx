/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Table
 */

import "./MultiValueFilter.scss";
import React from "react";
import { Button, ButtonType, CheckListBox, CheckListBoxItem, SearchBox, UiCore } from "@bentley/ui-core";
import { PopupButton, PopupContent } from "../../../editors/PopupButton";
import { ReactDataGridColumn } from "../../component/TableColumn";
import { UiComponents } from "../../../UiComponents";
import { FilterCompositionLogicalOperator, TableDistinctValue } from "../ColumnFiltering";
import { FieldFilterData, MultiValueFilterData } from "../DataGridFilterParser";

function contains(valueA: string, valueB: string, caseSensitive: boolean): boolean {
  // istanbul ignore next
  if (!valueA || !valueB || valueB.length > valueA.length)
    return false;

  if (caseSensitive)
    return valueA.indexOf(valueB, 0) !== -1;

  return valueA.toLocaleUpperCase().indexOf(valueB.toLocaleUpperCase(), 0) !== -1;
}

/** @internal */
export interface MultiValueFilterProps {
  onChange: (args: { filterTerm: any, column: ReactDataGridColumn }) => void;
  column: ReactDataGridColumn;
  getValidFilterValues: (key: string) => any[];
  placeholder?: string;
}

/** @internal */
export function MultiValueFilter(props: MultiValueFilterProps) {
  const [clearLabel] = React.useState(() => UiCore.translate("general.clear"));
  const [filterLabel] = React.useState(() => UiComponents.translate("button.label.filter"));
  const [cancelLabel] = React.useState(() => UiCore.translate("dialog.cancel"));
  const [searchLabel] = React.useState(() => UiComponents.translate("button.label.search"));
  const [distinctFilter] = React.useState(() => props.column.filterableColumn!.columnFilterDescriptor.distinctFilter);
  const [buttonLabel, setButtonLabel] = React.useState<string | undefined>(undefined);
  const [searchText, setSearchText] = React.useState("");
  const [filterCaseSensitive] = React.useState(() => !!props.column.filterableColumn!.filterCaseSensitive);
  const [showDistinctValueFilters] = React.useState(() => !!props.column.filterableColumn!.showDistinctValueFilters);
  const popupButtonRef = React.useRef<PopupButton>(null);

  const distinctValues = React.useMemo((): TableDistinctValue[] => {
    let options = props.getValidFilterValues(props.column.key);
    options = options.map((o: any) => {
      // istanbul ignore next
      if (typeof o === "string") {
        return { value: o, label: o };
      }
      return o;
    });
    return options;
  }, [props]);

  const checkedValues = React.useMemo((): TableDistinctValue[] => {
    const values = new Array<TableDistinctValue>();
    for (const distinctValue of distinctValues) {
      if (distinctFilter.tryFindDescriptor(distinctValue.value) !== undefined)
        values.push(distinctValue);
    }
    return values;
  }, [distinctValues, distinctFilter]);

  const [checkedDistinctValues, setCheckedDistinctValues] = React.useState<TableDistinctValue[]>(() => checkedValues);

  React.useEffect(() => {
    setCheckedDistinctValues(checkedValues);
  }, [checkedValues]);

  const handleClear = React.useCallback(() => {
    checkedDistinctValues.length = 0;
    const newValues = checkedDistinctValues.slice();
    setCheckedDistinctValues(newValues);
  }, [checkedDistinctValues]);

  const closePopup = () => {
    // istanbul ignore else
    if (popupButtonRef.current)
      popupButtonRef.current.closePopup();
  };

  const handleApplyFilter = React.useCallback(() => {
    const filterData: MultiValueFilterData = {
      distinctValues: new Array<TableDistinctValue>(),
      fieldValues: new Array<FieldFilterData>(),
      fieldLogicalOperator: FilterCompositionLogicalOperator.And,
    };

    for (const checkedDistinctValue of checkedDistinctValues) {
      filterData.distinctValues.push(checkedDistinctValue);
    }

    closePopup();
    setSearchText("");

    let label: string | undefined;
    if (checkedDistinctValues.length === 1)
      label = checkedDistinctValues[0].label;
    else if (checkedDistinctValues.length > 1)
      label = `${checkedDistinctValues[0].label} (+${checkedDistinctValues.length - 1})`;
    setButtonLabel(label);

    props.onChange({ filterTerm: filterData, column: props.column });
  }, [props, checkedDistinctValues]);

  const handleCancel = React.useCallback(() => {
    closePopup();
    setSearchText("");
  }, []);

  const handleSearchValueChanged = React.useCallback((value: string): void => {
    setSearchText(value);
  }, []);

  const handleCheckboxChanged = React.useCallback((e: React.ChangeEvent<HTMLInputElement>, distinctValue: TableDistinctValue) => {
    const index = checkedDistinctValues.indexOf(distinctValue);
    if (e.target.checked) {
      // istanbul ignore else
      if (index === -1) {
        checkedDistinctValues.push(distinctValue);
        const newValues = checkedDistinctValues.slice();
        setCheckedDistinctValues(newValues);
      }
    } else {
      // istanbul ignore else
      if (index !== -1) {
        checkedDistinctValues.splice(index, 1);
        const newValues = checkedDistinctValues.slice();
        setCheckedDistinctValues(newValues);
      }
    }
  }, [checkedDistinctValues]);

  const checkBoxItems = React.useMemo((): JSX.Element[] => {
    const items = distinctValues
      .filter((distinctValue: TableDistinctValue) => {
        return (searchText.length === 0 || contains(distinctValue.label, searchText, filterCaseSensitive));
      })
      .map((distinctValue: TableDistinctValue, i: number) => {
        const checked = checkedDistinctValues.find((checkedDistinctValue) => checkedDistinctValue.value === distinctValue.value) !== undefined;
        return (
          <CheckListBoxItem key={i} label={distinctValue.label} checked={checked}
            onChange={(e) => handleCheckboxChanged(e, distinctValue)} />
        );
      });
    return items;
  }, [checkedDistinctValues, distinctValues, handleCheckboxChanged, searchText, filterCaseSensitive]);

  return (
    <div data-testid="components-multi-value-filter">
      <PopupButton placeholder={props.placeholder || filterLabel}
        label={buttonLabel}
        closeOnEnter={false}
        setFocus={false}
        moveFocus={false}
        ref={popupButtonRef}
      >
        <PopupContent>
          {showDistinctValueFilters &&
            <div>
              <div className="components-multi-value-filter-searchbox">
                <SearchBox placeholder={searchLabel} onValueChanged={handleSearchValueChanged} valueChangedDelay={250} />
              </div>
              <div className="components-multi-value-filter-distinct-values">
                <CheckListBox>
                  {checkBoxItems}
                </CheckListBox>
              </div>
            </div>
          }
          <div className="components-multi-value-buttons">
            <Button onClick={handleClear} data-testid="components-multi-value-button-clear">{clearLabel}</Button>
            <Button onClick={handleApplyFilter} data-testid="components-multi-value-button-filter">{filterLabel}</Button>
            <Button buttonType={ButtonType.Hollow} onClick={handleCancel} data-testid="components-multi-value-button-cancel">{cancelLabel}</Button>
          </div>
        </PopupContent>
      </PopupButton>
    </div>
  );
}
