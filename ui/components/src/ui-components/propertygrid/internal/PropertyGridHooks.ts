/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { IPropertyGridModel } from "./PropertyGridModel";
import { MutableGridItemFactory } from "./flat-items/MutableGridItemFactory";
import { IPropertyDataProvider } from "../PropertyDataProvider";
import { IPropertyGridModelSource, PropertyGridModelSource } from "./PropertyGridModelSource";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { PropertyGridEventHandler } from "./PropertyGridEventHandler";
import { useDebouncedAsyncValue } from "../../common/UseDebouncedAsyncValue";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyGridCommons } from "../component/PropertyGridCommons";

/**
 * Custom hook that gets propertyData from data provider and subscribes to further data changes.
 * Returned property data has links.onClick replaced by passed onPropertyLinkClick or default implementation
 * @param dataProvider Property data provider to get propertyData from.
 * @param onPropertyLinkClick function to replace links.onClick with.
 * @alpha
 */
export function usePropertyData(props: { dataProvider: IPropertyDataProvider, onPropertyLinkClick?: (property: PropertyRecord, text: string) => void }) {
  const { dataProvider, onPropertyLinkClick } = { ...props };

  const [forcedUpdate, triggerForcedUpdate] = useReducer((currentValue) => !currentValue, false);

  // ForcedUpdate is added to dependency list to re-memo getData promise when onDataChanged emits an event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scheduledReturn = useDebouncedAsyncValue(useCallback(async () => dataProvider.getData(), [dataProvider, forcedUpdate]));

  useEffect(() => {
    return dataProvider.onDataChanged.addListener(triggerForcedUpdate);
  }, [dataProvider]);

  useEffect(() => {
    const propertyData = scheduledReturn.value;
    if (!propertyData)
      return;

    for (const categoryName in propertyData.records) {
      // istanbul ignore else
      if (propertyData.records.hasOwnProperty(categoryName))
        PropertyGridCommons.assignRecordClickHandlers(propertyData.records[categoryName], onPropertyLinkClick);
    }
  }, [scheduledReturn, onPropertyLinkClick]);

  return scheduledReturn;
}

/**
 * Custom hook that creates a PropertyGridModelSource and subscribes it to data updates from the data provider.
 * @alpha
 */
export function usePropertyGridModelSource(props: { dataProvider: IPropertyDataProvider, onPropertyLinkClick?: (property: PropertyRecord, text: string) => void }) {
  const { value: propertyData } = usePropertyData(props);
  const { dataProvider } = { ...props };

  // Model source needs to be recreated if data provider changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modelSource = useMemo(() => new PropertyGridModelSource(new MutableGridItemFactory()), [dataProvider]);

  useEffect(() => {
    if (propertyData)
      modelSource.setPropertyData(propertyData);
  }, [propertyData, modelSource]);

  return modelSource;
}

/**
 * Custom hook that creates memoized version of PropertyGridEventHandler that modifies given modelSource
 * @alpha
 */
export function usePropertyGridEventHandler(props: { modelSource: IPropertyGridModelSource }) {
  return useMemo(() => new PropertyGridEventHandler(props.modelSource), [props.modelSource]);
}

/**
 * Custom hook that automatically listens and retrieves latest model from model source
 * @alpha
 */
export function usePropertyGridModel(props: { modelSource: IPropertyGridModelSource }) {
  const { modelSource } = { ...props };
  const [model, setModel] = useState<IPropertyGridModel>();

  useEffect(() => {
    const modelChanged = () => {
      setModel(modelSource.getModel());
    };

    modelChanged();
    return modelSource.onModelChanged.addListener(modelChanged);
  }, [modelSource]);

  return model;
}
