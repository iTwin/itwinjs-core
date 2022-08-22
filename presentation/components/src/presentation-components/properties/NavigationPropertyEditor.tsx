/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * @packageDocumentation
 * @module Properties
 */

import * as React from "react";
import { PropertyRecord, PropertyValue, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { PropertyEditorBase, PropertyEditorManager, PropertyEditorProps, TypeEditor } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import {
  ContentFlags, ContentSpecificationTypes, InstanceKey, KeySet, LabelDefinition, NavigationPropertyInfo, Ruleset,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { ValueType } from "react-select";
import { AsyncPaginate } from 'react-select-async-paginate';

/**
 * @alpha
 */
export class NavigationPropertyEditor extends PropertyEditorBase {
  public override get containerHandlesEnter(): boolean {
    return false;
  }

  public override get containerStopsKeydownPropagation(): boolean {
    return false;
  }

  public get reactNode(): React.ReactNode {
    return <NavigationEditor />;
  }
}

PropertyEditorManager.registerEditor(StandardTypeNames.Navigation, NavigationPropertyEditor);

/** @alpha */
export interface NavigationPropertyEditorContextProps {
  imodel: IModelConnection;
  getNavigationPropertyInfo: (record: PropertyRecord) => Promise<NavigationPropertyInfo | undefined>;
}

/** @alpha */
export const NavigationPropertyEditorContext = React.createContext<NavigationPropertyEditorContextProps | undefined>(undefined);

class NavigationEditor extends React.PureComponent<PropertyEditorProps> implements TypeEditor {
  private _ref = React.createRef<NavigationEditorAttributes>();

  public async getPropertyValue() {
    return this._ref.current?.getValue();
  }

  public get htmlElement() {
    return this._ref.current?.divElement ?? null;
  }

  public get hasFocus() {
    if (!this._ref.current || !document.activeElement)
      return false;
    return document.activeElement.contains(this._ref.current.divElement);
  }

  /** @internal */
  public override render() {
    return <NavigationEditorInner ref={this._ref} {...this.props} />;
  }
}

interface NavigationEditorAttributes {
  getValue: () => PropertyValue | undefined;
  divElement: HTMLDivElement | null;
}

const NavigationEditorInner = React.forwardRef<NavigationEditorAttributes, PropertyEditorProps>((props, ref) => {
  const navigationPropertyEditorContext = React.useContext(NavigationPropertyEditorContext);
  if (!navigationPropertyEditorContext)
    return null;

  return <NavigationPropertyTargetSelector
    {...props}
    ref={ref}
    imodel={navigationPropertyEditorContext.imodel}
    getNavigationPropertyInfo={navigationPropertyEditorContext.getNavigationPropertyInfo}
  />;
});
NavigationEditorInner.displayName = "NavigationEditorInner";

interface NavigationPropertyTargetSelectorProps extends PropertyEditorProps {
  imodel: IModelConnection;
  getNavigationPropertyInfo: (record: PropertyRecord) => Promise<NavigationPropertyInfo | undefined>;
}

const NavigationPropertyTargetSelector = React.forwardRef<NavigationEditorAttributes, NavigationPropertyTargetSelectorProps>((props, ref) => {
  const { imodel, getNavigationPropertyInfo, propertyRecord, onCommit } = props;
  const divRef = React.useRef<HTMLDivElement>(null);
  // const { targets, isLoading, loadMoreTargets } = useNavigationPropertyTargets(imodel, getNavigationPropertyInfo, "", propertyRecord);
  const loadTargets = useTargetsLoader(imodel, getNavigationPropertyInfo, propertyRecord);

  const [selectedTarget, setSelectedTarget] = React.useState<NavigationTarget | undefined>();

  const onChange = React.useCallback((target?: NavigationTarget) => {
    setSelectedTarget(target);
    if (target && propertyRecord && onCommit)
      onCommit({ propertyRecord, newValue: getPropertyValue(target.key) });
  }, [propertyRecord, onCommit]);

  React.useImperativeHandle(ref,
    () => ({
      getValue: () => getPropertyValue(selectedTarget?.key),
      divElement: divRef.current,
    }),
    [selectedTarget]
  );

  return <div ref={divRef}>
    <TargetSelector
      loadTargets={loadTargets}
      onTargetChanged={onChange}
      value={selectedTarget}
    />
  </div>;
});
NavigationPropertyTargetSelector.displayName = "NavigationPropertyTargetSelector";

function getPropertyValue(key?: InstanceKey): PropertyValue {
  return { valueFormat: PropertyValueFormat.Primitive, value: key };
}

interface NavigationTarget {
  label: LabelDefinition;
  key: InstanceKey;
}

interface TargetSelectorProps {
  loadTargets: (filter: string, loadedOptions: NavigationTarget[]) => Promise<{ options: NavigationTarget[]; hasMore: boolean; }>;
  onTargetChanged: (target?: NavigationTarget) => void;
  value: NavigationTarget | undefined;
}

function TargetSelector(props: TargetSelectorProps) {
  const { loadTargets, onTargetChanged, value } = props;

  const onChange = React.useCallback((option: ValueType<NavigationTarget>) => {
    onTargetChanged(option as NavigationTarget);
  }, [onTargetChanged]);

  const getOptionLabel = (option: NavigationTarget) => option.label.displayValue;
  const getOptionValue = (option: NavigationTarget) => option.key.id;

  return <AsyncPaginate
    isMulti={false}
    onChange={onChange}
    loadOptions={loadTargets}
    getOptionLabel={getOptionLabel}
    getOptionValue={getOptionValue}
    hideSelectedOptions={false}
    value={value}
  />;
}

const TARGETS_PAGE_SIZE = 100;
function useTargetsLoader(
  imodel: IModelConnection,
  getNavigationPropertyInfo: (record: PropertyRecord) => Promise<NavigationPropertyInfo | undefined>,
  record?: PropertyRecord,
) {
  const targetsRuleset = useTargetsRuleset(getNavigationPropertyInfo, record);

  const loadTargets = React.useCallback(async (filter: string, loadedOptions: NavigationTarget[]): Promise<{ options: NavigationTarget[]; hasMore: boolean; }> => {
    if (!targetsRuleset) {
      return { options: [], hasMore: false };
    }

    const content = await Presentation.presentation.getContent({
      imodel,
      rulesetOrId: targetsRuleset,
      keys: new KeySet(),
      descriptor: {
        contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
        filterExpression: filter ? `/DisplayLabel/ LIKE \"%${filter}%\"` : undefined,
      },
      paging: { start: loadedOptions.length, size: TARGETS_PAGE_SIZE },
    });

    return {
      options: content?.contentSet.map((item) => ({
        label: item.label,
        key: item.primaryKeys[0],
      })) ?? [],
      hasMore: content !== undefined && content.contentSet.length === TARGETS_PAGE_SIZE,
    };
  }, [targetsRuleset, imodel]);

  return loadTargets;
}

function useTargetsRuleset(
  getNavigationPropertyInfo: (record: PropertyRecord) => Promise<NavigationPropertyInfo | undefined>,
  record?: PropertyRecord,
) {
  const [ruleset, setRuleset] = React.useState<Ruleset>();

  React.useEffect(() => {
    if (!record) {
      setRuleset(undefined);
      return;
    }

    let disposed = false;
    void (async () => {
      const propertyInfo = await getNavigationPropertyInfo(record);
      if (!disposed && propertyInfo)
        setRuleset(createNavigationTargetRuleset(propertyInfo));
    })();
    return () => { disposed = true; };
  }, [record, getNavigationPropertyInfo]);

  return ruleset;
}

function createNavigationTargetRuleset(propertyInfo: NavigationPropertyInfo): Ruleset {
  const [schemaName, className] = propertyInfo.targetClassInfo.name.split(":");
  return {
    id: `navigation-property-targets`,
    rules: [{
      ruleType: RuleTypes.Content,
      specifications: [{
        specType: ContentSpecificationTypes.ContentInstancesOfSpecificClasses,
        classes: { schemaName, classNames: [className], arePolymorphic: propertyInfo.isTargetPolymorphic },
      }],
    }],
  };
}
