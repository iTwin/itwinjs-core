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
import { assert, Id64String } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { Badge, Tooltip } from "@itwin/itwinui-react";
import { ClassInfo, Descriptor } from "@itwin/presentation-common";
import { translate } from "../common/Utils";
import { navigationPropertyEditorContext, NavigationPropertyEditorContext } from "../properties/NavigationPropertyEditor";
import { ClassHierarchiesSet, ECClassHierarchyProvider } from "./ECClassesHierarchy";
import { InstanceFilterBuilder } from "./InstanceFilterBuilder";
import { InstanceFilterPropertyInfo, PresentationInstanceFilter } from "./Types";
import { createInstanceFilterPropertyInfos, createPresentationInstanceFilter, getInstanceFilterFieldName } from "./Utils";
import "./PresentationInstanceFilterBuilder.scss";

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
  const classHierarchyProvider = useECClassHierarchyProvider(imodel);
  const filteringProps = usePresentationInstanceFilteringProps(descriptor, classHierarchyProvider);

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
export function usePresentationInstanceFilteringProps(descriptor: Descriptor, classHierarchyProvider?: ECClassHierarchyProvider) {
  const [selectedClasses, setSelectedClasses] = React.useState<ClassInfo[]>([]);
  const propertyInfos = React.useMemo(() => createInstanceFilterPropertyInfos(descriptor), [descriptor]);
  const properties = React.useMemo(() => {
    const matchingClassesSet = getClassesSet(selectedClasses.map((selectedClass) => selectedClass.id), classHierarchyProvider);
    // filter properties that are available on all selected classes
    return propertyInfos
      .filter((info) => !matchingClassesSet || matchingClassesSet.has(info.sourceClassId, { isBase: true, isDerived: true }, true))
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
    const propertyInfo = propertyInfos.find((info) => info.propertyDescription.name === property.name);
    if (!propertyInfo)
      return;

    setSelectedClasses((prevClasses) => {
      const selectedClassesByProperty = computeSelectedClassesByProperty(propertyInfo, classes, prevClasses, classHierarchyProvider);
      return selectedClassesByProperty ?? prevClasses;
    });
  }, [classes, propertyInfos, classHierarchyProvider]);

  const propertyRenderer = React.useCallback((name: string) => {
    const instanceFilterPropertyInfo = propertyInfos.find((info) => info.propertyDescription.name === name);
    assert(instanceFilterPropertyInfo !== undefined);
    return <PresentationInstanceFilterProperty instanceFilterPropertyInfo={instanceFilterPropertyInfo} />;
  }, [propertyInfos]);

  return {
    onPropertySelected,
    onClearClasses,
    onClassDeselected,
    onClassSelected,
    propertyRenderer,
    properties,
    classes,
    selectedClasses,
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

interface CategoryTooltipContentProps {
  instanceFilterPropertyInfo: InstanceFilterPropertyInfo;
}

function CategoryTooltipContent(props: CategoryTooltipContentProps) {
  const { instanceFilterPropertyInfo } = props;
  const [schemaName, className] = instanceFilterPropertyInfo.className.split(":");
  return <table>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.category")}</th>
        <td className="tooltip-content-data">{instanceFilterPropertyInfo.categoryLabel}</td>
      </tr>
    </tbody>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.class")}</th>
        <td className="tooltip-content-data">{className}</td>
      </tr>
    </tbody>
    <tbody>
      <tr>
        <th className="tooltip-content-header">{translate("instance-filter-builder.schema")}</th>
        <td className="tooltip-content-data">{schemaName}</td>
      </tr>
    </tbody>
  </table>;
}

interface PresentationInstanceFilterPropertyProps {
  instanceFilterPropertyInfo: InstanceFilterPropertyInfo;
}

/** @alpha */
export function PresentationInstanceFilterProperty(props: PresentationInstanceFilterPropertyProps) {
  const { instanceFilterPropertyInfo } = props;
  return <div className="property-item-line">
    <Tooltip content={instanceFilterPropertyInfo.propertyDescription.displayLabel} placement="bottom">
      <div className="property-display-label" title={instanceFilterPropertyInfo.propertyDescription.displayLabel}>
        {instanceFilterPropertyInfo.propertyDescription.displayLabel}
      </div>
    </Tooltip>
    <div className="property-badge-container">
      {instanceFilterPropertyInfo.categoryLabel && <Tooltip content={<CategoryTooltipContent instanceFilterPropertyInfo={instanceFilterPropertyInfo} />} placement="bottom" style={{ textAlign: "left" }}>
        <div className="badge">
          <Badge className="property-category-badge" backgroundColor={"montecarlo"}>
            {instanceFilterPropertyInfo.categoryLabel}
          </Badge>
        </div>
      </Tooltip>}
    </div>
  </div>;
}

function getClassesSet(classIds: Id64String[], classHierarchyProvider?: ECClassHierarchyProvider): ClassHierarchiesSet | undefined {
  if (!classHierarchyProvider || classIds.length === 0)
    return undefined;

  return classHierarchyProvider.getClassHierarchiesSet(classIds);
}

function computeSelectedClassesByProperty(propertyInfo: InstanceFilterPropertyInfo, availableClasses: ClassInfo[], currentClasses: ClassInfo[], classHierarchyProvider?: ECClassHierarchyProvider) {
  // get set of classes that have property
  const propertyClass = classHierarchyProvider?.getClassHierarchy(propertyInfo.sourceClassId);
  /* istanbul ignore if */
  if (!propertyClass)
    return undefined;

  // get set of currently selected classes
  const selectedClassesSet = getClassesSet(currentClasses.map((currentClass) => currentClass.id), classHierarchyProvider);

  // find class infos that has property (class info is or is derived from property class) and
  // are derived from selected classes
  const propertyClassInfos = availableClasses.filter((classInfo) => {
    return propertyClass.is(classInfo.id, { isDerived: true }) &&
      (!selectedClassesSet || selectedClassesSet.has(classInfo.id, { isDerived: true }));
  });
  /* istanbul ignore if */
  if (propertyClassInfos.length === 0)
    return undefined;

  // filter out currently selected classes that do not have this property (currently selected class should be derived class of property classes)
  const selectedClasses = currentClasses.filter((currentClass) => propertyClass.is(currentClass.id, { isDerived: true }));

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
