/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SvgAdd, SvgDelete } from "@itwin/itwinui-icons-react";
import { Button, ButtonGroup, IconButton, Select, SelectOption } from "@itwin/itwinui-react";
import { UiComponents } from "../UiComponents";
import { FilterBuilderContext } from "./FilterBuilder";
import { FilterBuilderRuleRenderer } from "./FilterBuilderRule";
import { FilterBuilderRuleGroup, FilterBuilderRuleGroupItem, isFilterBuilderRuleGroup } from "./FilterBuilderState";
import { FilterRuleGroupOperator } from "./Operators";

/** @alpha */
export interface FilterBuilderRuleGroupRendererProps {
  path: string[];
  group: FilterBuilderRuleGroup;
}

/** @alpha */
export function FilterBuilderRuleGroupRenderer(props: FilterBuilderRuleGroupRendererProps) {
  const { path, group } = props;
  const { actions } = React.useContext(FilterBuilderContext);

  const addRule = () => actions.addItem(path, "RULE");
  const addRuleGroup = () => actions.addItem(path, "RULE_GROUP");
  const removeGroup = () => actions.removeItem(path);

  const onOperatorChange = React.useCallback((operator) => {
    actions.setRuleGroupOperator(path, operator);
  }, [path, actions]);

  return <div className="rule-group">
    <div className="rule-group-header">
      <FilterBuilderRuleGroupOperator operator={group.operator} onChange={onOperatorChange}/>
      <ButtonGroup className="rule-group-actions">
        <Button data-testid="rule-group-add-rule" onClick={addRule} styleType="borderless" size="small" startIcon={<SvgAdd />}>
          {UiComponents.translate("filterBuilder.rule")}
        </Button>
        <Button data-testid="rule-group-add-rule-group" onClick={addRuleGroup} styleType="borderless" size="small" startIcon={<SvgAdd />}>
          {UiComponents.translate("filterBuilder.ruleGroup")}
        </Button>
        {group.groupId !== undefined && <IconButton data-testid="rule-group-remove" onClick={removeGroup} styleType="borderless" size="small"><SvgDelete /></IconButton>}
      </ButtonGroup>
    </div>
    <div className="rule-group-items">
      {group.items.map((item) => <FilterBuilderGroupOrRule key={item.id} path={path} item={item} />)}
    </div>
  </div>;
}

/** @alpha */
export interface FilterBuilderRuleGroupOperatorProps {
  operator: FilterRuleGroupOperator;
  onChange: (operator: FilterRuleGroupOperator) => void;
}

/** @alpha */
export function FilterBuilderRuleGroupOperator(props: FilterBuilderRuleGroupOperatorProps) {
  const {operator, onChange} = props;

  const options = React.useMemo<Array<SelectOption<FilterRuleGroupOperator>>>(() => ([
    { value: FilterRuleGroupOperator.And, label: UiComponents.translate("filterBuilder.operators.and") },
    { value: FilterRuleGroupOperator.Or, label: UiComponents.translate("filterBuilder.operators.or") },
  ]), []);

  return <div className="rule-group-operator">
    <Select options={options} value={operator} onChange={onChange} size="small" />
  </div>;
}
interface FilterBuilderGroupOrRuleProps {
  path: string[];
  item: FilterBuilderRuleGroupItem;
}

function FilterBuilderGroupOrRule({path, item}: FilterBuilderGroupOrRuleProps) {
  const itemPath = React.useMemo(() => ([...path, item.id]), [path, item]);

  return <div className="rule-group-or-rule">
    {isFilterBuilderRuleGroup(item)
      ? <FilterBuilderRuleGroupRenderer path={itemPath} group={item} />
      :<FilterBuilderRuleRenderer path={itemPath} rule={item} />}
  </div>;
}
