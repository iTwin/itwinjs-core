/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useDebouncedAsyncValue } from "../../common/UseDebouncedAsyncValue";
import type { IPropertyDataProvider } from "../PropertyDataProvider";
import { MutableGridItemFactory } from "./flat-items/MutableGridItemFactory";
import { PropertyGridEventHandler } from "./PropertyGridEventHandler";
import type { IPropertyGridModel } from "./PropertyGridModel";
import type { IPropertyGridModelSource} from "./PropertyGridModelSource";
import { PropertyGridModelSource } from "./PropertyGridModelSource";

/**
 * Custom hook that gets [[PropertyData]] from given [[IPropertyDataProvider]] and subscribes to further data changes.
 * @public
 */
export function usePropertyData(props: { dataProvider: IPropertyDataProvider }) {
  const { dataProvider } = props;

  const [forcedUpdate, triggerForcedUpdate] = useReducer(() => ({}), {});
  useEffect(() => {
    return dataProvider.onDataChanged.addListener(() => {
      triggerForcedUpdate();
    });
  }, [dataProvider]);

  // forcedUpdate is added to dependency list to re-memo getData promise when onDataChanged emits an event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useDebouncedAsyncValue(useCallback(async () => dataProvider.getData(), [dataProvider, forcedUpdate]));
}

/**
 * Custom hook that creates a [[PropertyGridModelSource]] and subscribes it to data updates from the data provider.
 * @beta
 */
export function usePropertyGridModelSource(props: { dataProvider: IPropertyDataProvider }) {
  const { value: propertyData } = usePropertyData(props);
  const { dataProvider } = { ...props };

  // Model source needs to be recreated if data provider changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modelSource = useMemo(() => new PropertyGridModelSource(new MutableGridItemFactory()), [dataProvider]);

  useEffect(() => {
    if (propertyData)
      modelSource.setPropertyData(propertyData);
  }, [modelSource, propertyData]);

  return modelSource;
}

/**
 * Custom hook that creates memoized version of [[PropertyGridEventHandler]] that modifies given modelSource
 * @beta
 */
export function usePropertyGridEventHandler(props: { modelSource: IPropertyGridModelSource }) {
  return useMemo(() => new PropertyGridEventHandler(props.modelSource), [props.modelSource]);
}

/**
 * Custom hook that automatically listens and retrieves latest model from model source
 * @beta
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
