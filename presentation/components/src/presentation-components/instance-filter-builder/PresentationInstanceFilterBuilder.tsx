/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { PropertyFilter } from "@itwin/components-react";
import { assert } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassInfo, Descriptor } from "@itwin/presentation-common";
import { navigationPropertyEditorContext, NavigationPropertyEditorContext } from "../properties/NavigationPropertyEditor";
import { getImodelMetadataProvider } from "./ECMetadataProvider";
import { InstanceFilterBuilder } from "./InstanceFilterBuilder";
import { PresentationInstanceFilterProperty } from "./PresentationInstanceFilterProperty";
import { InstanceFilterPropertyInfo, PresentationInstanceFilter } from "./Types";
import { createInstanceFilterPropertyInfos, createPresentationInstanceFilter, getInstanceFilterFieldName } from "./Utils";

/** @alpha */
export interface PresentationInstanceFilterBuilderProps {
  imodel: IModelConnection;
  descriptor: Descriptor;
  onInstanceFilterChanged: (filter?: PresentationInstanceFilter) => void;
  enableClassFilteringByProperties?: boolean;
  ruleGroupDepthLimit?: number;
}

/** @alpha */
export function PresentationInstanceFilterBuilder(props: PresentationInstanceFilterBuilderProps) {
  const { imodel, descriptor, onInstanceFilterChanged, ruleGroupDepthLimit } = props;
  const filteringProps = usePresentationInstanceFilteringProps(descriptor, imodel);

  const onFilterChanged = React.useCallback((filter?: PropertyFilter) => {
    const presentationFilter = filter ? createPresentationInstanceFilter(descriptor, filter) : undefined;
    onInstanceFilterChanged(presentationFilter);
  }, [descriptor, onInstanceFilterChanged]);

  const contextValue = useFilterBuilderNavigationPropertyEditorContext(imodel, descriptor);

  return <navigationPropertyEditorContext.Provider value={contextValue}>
    <InstanceFilterBuilder
      {...filteringProps}
      onFilterChanged={onFilterChanged}
      ruleGroupDepthLimit={ruleGroupDepthLimit}
    />
  </navigationPropertyEditorContext.Provider>;
}

/** @alpha */
export function usePresentationInstanceFilteringProps(descriptor: Descriptor, imodel: IModelConnection) {
  const propertyInfos = React.useMemo(() => createInstanceFilterPropertyInfos(descriptor), [descriptor]);
  const classes = React.useMemo(() => descriptor.selectClasses.map((selectClass) => selectClass.selectClassInfo), [descriptor]);

  const {
    selectedClasses, onClassSelected, onClassDeselected, onClearClasses, isFilteringClasses, filterClassesByProperty,
  } = useSelectedClasses(classes, imodel);
  const { properties, isFilteringProperties } = useProperties(propertyInfos, selectedClasses, imodel);

  const onPropertySelected = React.useCallback((property: PropertyDescription) => {
    const propertyInfo = propertyInfos.find((info) => info.propertyDescription.name === property.name);
    if (propertyInfo)
      filterClassesByProperty(propertyInfo);
  }, [propertyInfos, filterClassesByProperty]);

  const propertyRenderer = React.useCallback((name: string) => {
    const instanceFilterPropertyInfo = propertyInfos.find((info) => info.propertyDescription.name === name);
    assert(instanceFilterPropertyInfo !== undefined);
    return <PresentationInstanceFilterProperty instanceFilterPropertyInfo={instanceFilterPropertyInfo} />;
  }, [propertyInfos]);

  return {
    onClassSelected,
    onClassDeselected,
    onPropertySelected,
    propertyRenderer,
    onClearClasses,
    classes,
    selectedClasses,
    properties,
    isDisabled: isFilteringClasses || isFilteringProperties,
  };
}

function useProperties(propertyInfos: InstanceFilterPropertyInfo[], selectedClasses: ClassInfo[], imodel: IModelConnection) {
  const [filteredProperties, setFilteredProperties] = React.useState<InstanceFilterPropertyInfo[] | undefined>();
  const [isFilteringProperties, setIsFilteringProperties] = React.useState(false);
  const properties = React.useMemo(
    () => (filteredProperties ?? propertyInfos).map((info) => info.propertyDescription),
    [propertyInfos, filteredProperties]
  );

  // filter properties by selected classes
  React.useEffect(() => {
    if (selectedClasses.length === 0) {
      setFilteredProperties(undefined);
      return;
    }

    setIsFilteringProperties(true);
    let disposed = false;
    void (async () => {
      const newFilteredProperties = await computePropertiesByClasses(propertyInfos, selectedClasses, imodel);
      // istanbul ignore else
      if (!disposed) {
        setFilteredProperties(newFilteredProperties);
        setIsFilteringProperties(false);
      }
    })();
    return () => { disposed = true; };
  }, [propertyInfos, selectedClasses, imodel]);

  return {
    properties,
    isFilteringProperties,
  };
}

function useSelectedClasses(classes: ClassInfo[], imodel: IModelConnection) {
  const [selectedClasses, setSelectedClasses] = React.useState<ClassInfo[]>([]);
  const [isFilteringClasses, setIsFilteringClasses] = React.useState(false);
  const disposedRef = React.useRef(false);
  React.useEffect(() => () => { disposedRef.current = true; }, []);

  const onClassSelected = React.useCallback((info: ClassInfo) => {
    setSelectedClasses((prevClasses) => [...prevClasses, info]);
  }, []);

  const onClassDeselected = React.useCallback((classInfo: ClassInfo) => {
    setSelectedClasses((prevClasses) => prevClasses.filter((info) => info.id !== classInfo.id));
  }, []);

  const onClearClasses = React.useCallback(() => {
    setSelectedClasses([]);
  }, []);

  const filterClassesByProperty = React.useCallback((property: InstanceFilterPropertyInfo) => {
    setIsFilteringClasses(true);
    void (async () => {
      const newSelectedClasses = await computeClassesByProperty(selectedClasses.length === 0 ? classes : selectedClasses, property, imodel);
      // istanbul ignore else
      if (!disposedRef.current) {
        setSelectedClasses(newSelectedClasses);
        setIsFilteringClasses(false);
      }
    })();
  }, [selectedClasses, classes, imodel]);

  return {
    selectedClasses,
    isFilteringClasses,
    onClassSelected,
    onClassDeselected,
    onClearClasses,
    filterClassesByProperty,
  };
}

/** @internal */
export function useFilterBuilderNavigationPropertyEditorContext(imodel: IModelConnection, descriptor: Descriptor) {
  return React.useMemo<NavigationPropertyEditorContext>(() => ({
    imodel,
    getNavigationPropertyInfo: async (property) => {
      const field = descriptor.getFieldByName(getInstanceFilterFieldName(property));
      if (!field || !field.isPropertiesField())
        return undefined;

      return field.properties[0].property.navigationPropertyInfo;
    },
  }), [imodel, descriptor]);
}

async function computePropertiesByClasses(properties: InstanceFilterPropertyInfo[], classes: ClassInfo[], imodel: IModelConnection): Promise<InstanceFilterPropertyInfo[] | undefined> {
  const metadataProvider = getImodelMetadataProvider(imodel);
  const ecClassInfos = await Promise.all(classes.map(async (info) => metadataProvider.getECClassInfo(info.id)));
  const filteredProperties: InstanceFilterPropertyInfo[] = [];
  for (const prop of properties) {
    // property should be shown if all selected classes are derived from property source class
    if (ecClassInfos.every((info) => info && info.isDerivedFrom(prop.sourceClassId)))
      filteredProperties.push(prop);
  }

  return filteredProperties.length === properties.length ? undefined : filteredProperties;
}

async function computeClassesByProperty(classes: ClassInfo[], property: InstanceFilterPropertyInfo, imodel: IModelConnection): Promise<ClassInfo[]> {
  const metadataProvider = getImodelMetadataProvider(imodel);
  const propertyClass = await metadataProvider.getECClassInfo(property.sourceClassId);
  // istanbul ignore next
  if (!propertyClass)
    return classes;

  const classesWithProperty: ClassInfo[] = [];
  for (const currentClass of classes) {
    // add classes that are derived from property source class
    if (propertyClass.isBaseOf(currentClass.id))
      classesWithProperty.push(currentClass);
  }

  return classesWithProperty;
}
