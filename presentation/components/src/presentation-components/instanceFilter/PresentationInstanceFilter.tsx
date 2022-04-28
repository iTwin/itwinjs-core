/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ClassInfo, Descriptor } from "@itwin/presentation-common";
import { ECInstanceFilterBuilder } from "./ECInstanceFilter";
import { IModelConnection } from "@itwin/core-frontend";
import { createInstanceFilterPropertyInfos, createPresentationInstanceFilter } from "./Utils";
import { Filter } from "@itwin/components-react";
import { ECClassesSet, ECClassHierarchy } from "./ECClassesHierarchy";
import { PresentationInstanceFilter, PropertyInfo } from "./Types";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Id64String } from "@itwin/core-bentley";

export interface PresentationInstanceFilterBuilderProps {
  imodel: IModelConnection;
  descriptor: Descriptor;
  onInstanceFilterChanged: (filter?: PresentationInstanceFilter) => void;
  enableClassFilteringBySelectedProperties?: boolean;
}

export function PresentationInstanceFilterBuilder(props: PresentationInstanceFilterBuilderProps) {
  const {imodel, descriptor, onInstanceFilterChanged, enableClassFilteringBySelectedProperties} = props;
  const [selectedClasses, setSelectedClasses] = React.useState<ClassInfo[]>([]);
  const classHierarchy = useECClassHierarchy(imodel);
  const propertyInfos = React.useMemo(() => createInstanceFilterPropertyInfos(descriptor), [descriptor]);
  const properties = React.useMemo(() => {
    const matchingClassesSet = getClassesSet(selectedClasses.map((selectedClass) => selectedClass.id), classHierarchy);
    return propertyInfos
      .filter((info) => !matchingClassesSet || info.sourceClassIds.some((id) => matchingClassesSet.has(id, {isDerived: true, isBase: true})))
      .map((info) => info.propertyDescription);
  }, [propertyInfos, selectedClasses, classHierarchy]);

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

  const onClearSelectedClasses = React.useCallback(() => {
    setSelectedClasses([]);
  }, []);

  const onPropertySelected = React.useCallback((property: PropertyDescription) => {
    if (!enableClassFilteringBySelectedProperties)
      return;
    const propertyInfo = propertyInfos.find((info) => info.propertyDescription.name === property.name);
    if (!propertyInfo)
      return;

    const selectedClassesByProperty = computeSelectedClassesByProperty(propertyInfo, classes, selectedClasses, classHierarchy);
    if (selectedClassesByProperty)
      setSelectedClasses(selectedClassesByProperty);
  }, [classes, propertyInfos, selectedClasses, classHierarchy, enableClassFilteringBySelectedProperties]);

  const onFilterChanged = React.useCallback((filter?: Filter) => {
    const presentationFilter = filter ? createPresentationInstanceFilter(descriptor, filter) : undefined;
    onInstanceFilterChanged(presentationFilter);
  }, [descriptor, onInstanceFilterChanged]);

  return <ECInstanceFilterBuilder
    selectedClasses={selectedClasses}
    classes={classes}
    properties={properties}
    onFilterChanged={onFilterChanged}
    onPropertySelected={onPropertySelected}
    onClassSelected={onClassSelected}
    onClassDeSelected={onClassDeSelected}
    onClearClasses={onClearSelectedClasses}
  />;
}

function getClassesSet(classIds: Id64String[], classHierarchy?: ECClassHierarchy): ECClassesSet | undefined {
  if (!classHierarchy || classIds.length === 0)
    return undefined;

  return classHierarchy.getMultipleClassIdsSet(classIds);
}

function computeSelectedClassesByProperty(propertyInfo: PropertyInfo, availableClasses: ClassInfo[], currentClasses: ClassInfo[], classHierarchy?: ECClassHierarchy) {
  // get set of classes that have property
  const propertyClassesSet = getClassesSet(propertyInfo.sourceClassIds, classHierarchy);
  if (!propertyClassesSet)
    return undefined;

  // get set of currently selected classes
  const selectedClassesSet = getClassesSet(currentClasses.map((currentClass) => currentClass.id), classHierarchy);

  // find class infos that has property (class info is or is derived from property class) and
  // are derived from selected classes
  const propertyClassInfos = availableClasses.filter((classInfo) => {
    return propertyClassesSet.has(classInfo.id, {isDerived: true}) &&
     (!selectedClassesSet || selectedClassesSet.has(classInfo.id, {isDerived: true}));
  });
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

function useECClassHierarchy(imodel: IModelConnection) {
  const [classHierarchy, setClassHierarchy] = React.useState<ECClassHierarchy | undefined>();
  const currentImodel = React.useRef(imodel);
  if (currentImodel.current !== imodel)
    currentImodel.current = imodel;
  React.useEffect(() => {
    void (async () => {
      const hierarchy = await ECClassHierarchy.create(imodel);
      if (currentImodel.current === imodel)
        setClassHierarchy(hierarchy);
    })();
  }, [imodel]);
  return classHierarchy;
}
