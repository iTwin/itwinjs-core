/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { PropertyRecord } from "@itwin/appui-abstract";
import { IModelConnection } from "@itwin/core-frontend";
import {
  ContentFlags, ContentSpecificationTypes, InstanceKey, KeySet, LabelDefinition, NavigationPropertyInfo, Ruleset, RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";

/** @internal */
export const NAVIGATION_PROPERTY_TARGETS_BATCH_SIZE = 100;

/** @internal */
export interface NavigationPropertyTarget {
  label: LabelDefinition;
  key: InstanceKey;
}

/** @internal */
export interface NavigationPropertyTargetsResult {
  options: NavigationPropertyTarget[];
  hasMore: boolean;
}

export interface UseNavigationPropertyTargetsLoaderProps {
  imodel: IModelConnection;
  ruleset?: Ruleset;
}

/** @internal */
export function useNavigationPropertyTargetsLoader(props: UseNavigationPropertyTargetsLoaderProps) {
  const { imodel, ruleset } = props;
  const loadTargets = React.useCallback(async (filter: string, loadedOptions: NavigationPropertyTarget[]): Promise<NavigationPropertyTargetsResult> => {
    if (!ruleset) {
      return { options: [], hasMore: false };
    }

    const content = await Presentation.presentation.getContent({
      imodel,
      rulesetOrId: ruleset,
      keys: new KeySet(),
      descriptor: {
        contentFlags: ContentFlags.ShowLabels | ContentFlags.NoFields,
        filterExpression: filter ? `/DisplayLabel/ LIKE \"%${filter}%\"` : undefined,
      },
      paging: { start: loadedOptions.length, size: NAVIGATION_PROPERTY_TARGETS_BATCH_SIZE },
    });

    return {
      options: content?.contentSet.map((item) => ({
        label: item.label,
        key: item.primaryKeys[0],
      })) ?? [],
      hasMore: content !== undefined && content.contentSet.length === NAVIGATION_PROPERTY_TARGETS_BATCH_SIZE,
    };
  }, [ruleset, imodel]);

  return loadTargets;
}

/** @internal */
export function useNavigationPropertyTargetsRuleset(
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
        setRuleset(createNavigationPropertyTargetsRuleset(propertyInfo));
    })();
    return () => { disposed = true; };
  }, [record, getNavigationPropertyInfo]);

  return ruleset;
}

function createNavigationPropertyTargetsRuleset(propertyInfo: NavigationPropertyInfo): Ruleset {
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
