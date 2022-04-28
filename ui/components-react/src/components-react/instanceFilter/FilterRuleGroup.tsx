/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Button, ButtonGroup, Select, SelectOption } from "@itwin/itwinui-react";
import { FilterBuilderContext } from "./FilterBuilder";
import { FilterRuleGroup, FilterRuleGroupItem, isFilterRuleGroup } from "./FilterBuilderState";
import { FilterBuilderRule } from "./FilterRule";
import { FilterRuleGroupOperator } from "./Operators";

/** @alpha */
export interface FilterBuilderRuleGroupProps {
  path: string[];
  group: FilterRuleGroup;
}

/** @alpha */
export function FilterBuilderRuleGroup(props: FilterBuilderRuleGroupProps) {
  const {path, group} = props;
  const {dispatch} = React.useContext(FilterBuilderContext);

  const addRule = () => dispatch({type: "ADD_ITEM", path, itemType: "RULE"});
  const addRuleGroup = () => dispatch({type: "ADD_ITEM", path, itemType: "RULE_GROUP"});
  const removeGroup = () => dispatch({type: "REMOVE_ITEM", path});

  const onOperatorChange = React.useCallback((operator) => {
    dispatch({type: "SET_RULE_GROUP_OPERATOR", path, operator});
  }, [path, dispatch]);

  return <div className="rule-group">
    <div className="header">
      <FilterBuilderRuleGroupOperator operator={group.operator} onChange={onOperatorChange}/>
      <ButtonGroup className="actions">
        <Button onClick={addRule} size="small">Add Rule</Button>
        <Button onClick={addRuleGroup} size="small">Add Rule Group</Button>
        {group.groupId !== undefined && <Button onClick={removeGroup} size="small">Remove Group</Button>}
      </ButtonGroup>
    </div>
    <div className="items">
      {group.items.map((item) => <FilterGroupItemRenderer key={item.id} path={path} item={item} />)}
    </div>
  </div>;
}

/** @alpha */
export interface FilterRuleGroupOperatorProps {
  operator: FilterRuleGroupOperator;
  onChange: (operator: FilterRuleGroupOperator) => void;
}

/** @alpha */
export function FilterBuilderRuleGroupOperator(props: FilterRuleGroupOperatorProps) {
  const {operator, onChange} = props;

  const options = React.useMemo<Array<SelectOption<FilterRuleGroupOperator>>>(() => ([{
    value: FilterRuleGroupOperator.And, label: "AND",
  }, {
    value: FilterRuleGroupOperator.Or, label: "OR",
  }]), []);

  return <div className="rule-group-operator">
    <Select options={options} value={operator} onChange={onChange} size="small" />
  </div>;
}

interface FilterGroupItemRendererProps {
  path: string[];
  item: FilterRuleGroupItem;
}

function FilterGroupItemRenderer({path, item}: FilterGroupItemRendererProps) {
  const itemPath = React.useMemo(() => ([...path, item.id]), [path, item]);
  if (isFilterRuleGroup(item))
    return <FilterBuilderRuleGroup path={itemPath} group={item} />;
  return <FilterBuilderRule path={itemPath} rule={item} />;
}
