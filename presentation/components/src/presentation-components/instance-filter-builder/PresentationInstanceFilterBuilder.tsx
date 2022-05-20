/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Filter } from "@itwin/components-react";
import { Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassInfo, Descriptor } from "@itwin/presentation-common";
import { ClassHierarchiesSet, ECClassHierarchyProvider } from "./ECClassesHierarchy";
import { ECInstanceFilterBuilder } from "./ECInstanceFilterBuilder";
import { PresentationInstanceFilter, PropertyInfo } from "./Types";
import { createInstanceFilterPropertyInfos, createPresentationInstanceFilter } from "./Utils";

export interface PresentationInstanceFilterBuilderProps {
  imodel: IModelConnection;
  descriptor: Descriptor;
  onInstanceFilterChanged: (filter?: PresentationInstanceFilter) => void;
  enableClassFilteringByProperties?: boolean;
}

export function PresentationInstanceFilterBuilder(props: PresentationInstanceFilterBuilderProps) {
  const {imodel, descriptor, onInstanceFilterChanged, enableClassFilteringByProperties} = props;
  const classHierarchyProvider = useECClassHierarchyProvider(imodel);
  const filteringProps = usePresentationInstanceFilteringProps(descriptor, classHierarchyProvider, enableClassFilteringByProperties);

  const onFilterChanged = React.useCallback((filter?: Filter) => {
    const presentationFilter = filter ? createPresentationInstanceFilter(descriptor, filter) : undefined;
    onInstanceFilterChanged(presentationFilter);
  }, [descriptor, onInstanceFilterChanged]);

  return <ECInstanceFilterBuilder
    onFilterChanged={onFilterChanged}
    {...filteringProps}
  />;
}

export function usePresentationInstanceFilteringProps(descriptor: Descriptor, classHierarchyProvider?: ECClassHierarchyProvider, enableClassFiltering?: boolean) {
  const [selectedClasses, setSelectedClasses] = React.useState<ClassInfo[]>([]);
  const propertyInfos = React.useMemo(() => createInstanceFilterPropertyInfos(descriptor), [descriptor]);
  const properties = React.useMemo(() => {
    const matchingClassesSet = getClassesSet(selectedClasses.map((selectedClass) => selectedClass.id), classHierarchyProvider);
    return propertyInfos
      .filter((info) => !matchingClassesSet || info.sourceClassIds.some((id) => matchingClassesSet.has(id, {isDerived: true, isBase: true})))
      .map((info) => info.propertyDescription);
  }, [propertyInfos, selectedClasses, classHierarchyProvider]);

  const classes = React.useMemo(() => descriptor.selectClasses.map((selectClass) => selectClass.selectClassInfo), [descriptor]);

  React.useEffect(() => {
    setSelectedClasses([]);
  }, [descriptor]);

  const onClassSelected = React.useCallback((classInfo: ClassInfo) => {
    setSelectedClasses([...selectedClasses, classInfo]);
  }, [selectedClasses]);

  const onClassDeSelected = React.useCallback((classInfo: ClassInfo) => {
    const removedClassIndex = selectedClasses.findIndex((info) => info.id === classInfo.id);
    if (removedClassIndex === -1)
      return;

    selectedClasses.splice(removedClassIndex, 1);
    setSelectedClasses([...selectedClasses]);
  }, [selectedClasses]);

  const onClearClasses = React.useCallback(() => {
    setSelectedClasses([]);
  }, []);

  const onPropertySelected = React.useCallback((property: PropertyDescription) => {
    if (!enableClassFiltering)
      return;
    const propertyInfo = propertyInfos.find((info) => info.propertyDescription.name === property.name);
    if (!propertyInfo)
      return;

    const selectedClassesByProperty = computeSelectedClassesByProperty(propertyInfo, classes, selectedClasses, classHierarchyProvider);
    if (selectedClassesByProperty)
      setSelectedClasses(selectedClassesByProperty);
  }, [classes, propertyInfos, selectedClasses, classHierarchyProvider, enableClassFiltering]);

  return {
    onPropertySelected,
    onClearClasses,
    onClassDeSelected,
    onClassSelected,
    properties,
    classes,
    selectedClasses,
  };
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
    return propertyClassesSet.has(classInfo.id, {isDerived: true}) &&
     (!selectedClassesSet || selectedClassesSet.has(classInfo.id, {isDerived: true}));
  });
  /* istanbul ignore if */
  if (propertyClassInfos.length === 0)
    return undefined;

  // filter out currently selected classes that do not have this property (currently selected class should be derived class of property classes)
  const selectedClasses = currentClasses.filter((currentClass) => propertyClassesSet.has(currentClass.id, {isDerived: true}));

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
  const [classHierarchyProvider, setClassHierarchyProvider] = React.useState<ECClassHierarchyProvider | undefined>();
  const currentImodel = React.useRef(imodel);
  /* istanbul ignore if */
  if (currentImodel.current !== imodel)
    currentImodel.current = imodel;

  const isMounted = React.useRef(true);
  React.useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    void (async () => {
      const hierarchyProvider = await ECClassHierarchyProvider.create(imodel);
      // ignore setting hierarchy provider if imodel changed while initializing it
      /* istanbul ignore else */
      if (currentImodel.current === imodel && isMounted.current)
        setClassHierarchyProvider(hierarchyProvider);
    })();
  }, [imodel]);
  return classHierarchyProvider;
}
