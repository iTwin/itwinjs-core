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
import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassInfo, Descriptor } from "@itwin/presentation-common";
import { NavigationPropertyEditorContext, NavigationPropertyEditorContextProps } from "../properties/NavigationPropertyEditor";
import { ClassHierarchiesSet, ECClassHierarchyProvider } from "./ECClassesHierarchy";
import { InstanceFilterBuilder } from "./InstanceFilterBuilder";
import { PresentationInstanceFilter, PropertyInfo } from "./Types";
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
  const { imodel, descriptor, onInstanceFilterChanged, enableClassFilteringByProperties, ruleGroupDepthLimit } = props;
  const classHierarchyProvider = useECClassHierarchyProvider(imodel);
  const filteringProps = usePresentationInstanceFilteringProps(descriptor, classHierarchyProvider, enableClassFilteringByProperties);

  const onFilterChanged = React.useCallback((filter?: PropertyFilter) => {
    const presentationFilter = filter ? createPresentationInstanceFilter(descriptor, filter) : undefined;
    onInstanceFilterChanged(presentationFilter);
  }, [descriptor, onInstanceFilterChanged]);

  const contextProps = useFilterBuilderNavigationPropertyEditorContextProps(imodel, descriptor);

  return <NavigationPropertyEditorContext.Provider value={contextProps}>
    <InstanceFilterBuilder
      {...filteringProps}
      onFilterChanged={onFilterChanged}
      ruleGroupDepthLimit={ruleGroupDepthLimit}
    />
  </NavigationPropertyEditorContext.Provider>;
}

/** @alpha */
export function usePresentationInstanceFilteringProps(descriptor: Descriptor, classHierarchyProvider?: ECClassHierarchyProvider, enableClassFiltering?: boolean) {
  const [selectedClasses, setSelectedClasses] = React.useState<ClassInfo[]>([]);
  const propertyInfos = React.useMemo(() => createInstanceFilterPropertyInfos(descriptor), [descriptor]);
  const properties = React.useMemo(() => {
    const matchingClassesSet = getClassesSet(selectedClasses.map((selectedClass) => selectedClass.id), classHierarchyProvider);
    return propertyInfos
      .filter((info) => !matchingClassesSet || info.sourceClassIds.some((id) => matchingClassesSet.has(id, { isDerived: true, isBase: true })))
      .map((info) => info.propertyDescription);
  }, [propertyInfos, selectedClasses, classHierarchyProvider]);

  const classes = React.useMemo(() => descriptor.selectClasses.map((selectClass) => selectClass.selectClassInfo), [descriptor]);

  React.useEffect(() => {
    setSelectedClasses([]);
  }, [descriptor]);

  const onClassSelected = React.useCallback((classInfo: ClassInfo) => {
    setSelectedClasses((prevClasses) => ([...prevClasses, classInfo]));
  }, []);

  const onClassDeselected = React.useCallback((classInfo: ClassInfo) => {
    setSelectedClasses((prevClasses) => prevClasses.filter((info) => info.id !== classInfo.id));
  }, []);

  const onClearClasses = React.useCallback(() => {
    setSelectedClasses([]);
  }, []);

  const onPropertySelected = React.useCallback((property: PropertyDescription) => {
    if (!enableClassFiltering)
      return;
    const propertyInfo = propertyInfos.find((info) => info.propertyDescription.name === property.name);
    if (!propertyInfo)
      return;

    setSelectedClasses((prevClasses) => {
      const selectedClassesByProperty = computeSelectedClassesByProperty(propertyInfo, classes, prevClasses, classHierarchyProvider);
      return selectedClassesByProperty ?? prevClasses;
    });
  }, [classes, propertyInfos, classHierarchyProvider, enableClassFiltering]);

  return {
    onPropertySelected,
    onClearClasses,
    onClassDeselected,
    onClassSelected,
    properties,
    classes,
    selectedClasses,
  };
}

/** @internal */
export function useFilterBuilderNavigationPropertyEditorContextProps(imodel: IModelConnection, descriptor: Descriptor) {
  return React.useMemo<NavigationPropertyEditorContextProps>(() => ({
    imodel,
    getNavigationPropertyInfo: async (record) => {
      const field = descriptor.getFieldByName(getInstanceFilterFieldName(record.property));
      if (!field || !field.isPropertiesField())
        return undefined;

      return field.properties[0].property.navigationPropertyInfo;
    },
  }), [imodel, descriptor]);
}

function getClassesSet(classIds: Id64String[], classHierarchyProvider?: ECClassHierarchyProvider): ClassHierarchiesSet | undefined {
  if (!classHierarchyProvider || classIds.length === 0)
    return undefined;

  return classHierarchyProvider.getClassHierarchiesSet(classIds);
}

function computeSelectedClassesByProperty(propertyInfo: PropertyInfo, availableClasses: ClassInfo[], currentClasses: ClassInfo[], classHierarchyProvider?: ECClassHierarchyProvider) {
  // get set of classes that have property
  const propertyClassesSet = getClassesSet(propertyInfo.sourceClassIds, classHierarchyProvider);
  /* istanbul ignore if */
  if (!propertyClassesSet)
    return undefined;

  // get set of currently selected classes
  const selectedClassesSet = getClassesSet(currentClasses.map((currentClass) => currentClass.id), classHierarchyProvider);

  // find class infos that has property (class info is or is derived from property class) and
  // are derived from selected classes
  const propertyClassInfos = availableClasses.filter((classInfo) => {
    return propertyClassesSet.has(classInfo.id, { isDerived: true }) &&
      (!selectedClassesSet || selectedClassesSet.has(classInfo.id, { isDerived: true }));
  });
  /* istanbul ignore if */
  if (propertyClassInfos.length === 0)
    return undefined;

  // filter out currently selected classes that do not have this property (currently selected class should be derived class of property classes)
  const selectedClasses = currentClasses.filter((currentClass) => propertyClassesSet.has(currentClass.id, { isDerived: true }));

  // add classes that have this property to the list
  let addedNewClass = false;
  for (const propertyClassInfo of propertyClassInfos) {
    if (selectedClasses.findIndex((selectedClass) => selectedClass.id === propertyClassInfo.id) === -1) {
      selectedClasses.push(propertyClassInfo);
      addedNewClass = true;
    }
  }
  if (selectedClasses.length === currentClasses.length && !addedNewClass)
    return undefined;

  return selectedClasses;
}

function useECClassHierarchyProvider(imodel: IModelConnection) {
  const [classHierarchyProvider, setClassHierarchyProvider] = React.useState<ECClassHierarchyProvider>();

  React.useEffect(() => {
    let disposed = false;
    void (async () => {
      const hierarchyProvider = await ECClassHierarchyProvider.create(imodel);
      /* istanbul ignore else */
      if (!disposed)
        setClassHierarchyProvider(hierarchyProvider);

    })();
    return () => { disposed = true; };
  }, [imodel]);

  return classHierarchyProvider;
}
