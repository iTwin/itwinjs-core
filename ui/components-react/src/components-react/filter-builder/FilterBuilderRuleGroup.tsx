/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SvgAdd, SvgDelete } from "@itwin/itwinui-icons-react";
import { Button, ButtonGroup, IconButton, Select, SelectOption } from "@itwin/itwinui-react";
import { UiComponents } from "../UiComponents";
import { PropertyFilterBuilderContext } from "./FilterBuilder";
import { PropertyFilterBuilderRuleRenderer } from "./FilterBuilderRule";
import { isPropertyFilterBuilderRuleGroup, PropertyFilterBuilderRuleGroup, PropertyFilterBuilderRuleGroupItem } from "./FilterBuilderState";
import { PropertyFilterRuleGroupOperator } from "./Operators";

/** @alpha */
export interface PropertyFilterBuilderRuleGroupRendererProps {
  path: string[];
  group: PropertyFilterBuilderRuleGroup;
}

/** @alpha */
export function PropertyFilterBuilderRuleGroupRenderer(props: PropertyFilterBuilderRuleGroupRendererProps) {
  const { path, group } = props;
  const { actions } = React.useContext(PropertyFilterBuilderContext);

  const addRule = () => actions.addItem(path, "RULE");
  const addRuleGroup = () => actions.addItem(path, "RULE_GROUP");
  const removeGroup = () => actions.removeItem(path);

  const onOperatorChange = React.useCallback((operator) => {
    actions.setRuleGroupOperator(path, operator);
  }, [path, actions]);

  return <div className="rule-group">
    <div className="rule-group-remove-action">
      {group.groupId !== undefined && <IconButton data-testid="rule-group-remove" onClick={removeGroup} styleType="borderless" size="small"><SvgDelete /></IconButton>}
    </div>
    <div className="rule-group-content">
      <PropertyFilterBuilderRuleGroupOperator operator={group.operator} onChange={onOperatorChange}/>
      <div className="rule-group-items">
        {group.items.map((item) => <PropertyFilterBuilderGroupOrRule key={item.id} path={path} item={item} />)}
      </div>
      <ButtonGroup className="rule-group-actions">
        <Button data-testid="rule-group-add-rule" onClick={addRule} styleType="borderless" size="small" startIcon={<SvgAdd />}>
          {UiComponents.translate("filterBuilder.rule")}
        </Button>
        <Button data-testid="rule-group-add-rule-group" onClick={addRuleGroup} styleType="borderless" size="small" startIcon={<SvgAdd />}>
          {UiComponents.translate("filterBuilder.ruleGroup")}
        </Button>
      </ButtonGroup>
    </div>
  </div>;
}

/** @alpha */
export interface PropertyFilterBuilderRuleGroupOperatorProps {
  operator: PropertyFilterRuleGroupOperator;
  onChange: (operator: PropertyFilterRuleGroupOperator) => void;
}

/** @alpha */
export function PropertyFilterBuilderRuleGroupOperator(props: PropertyFilterBuilderRuleGroupOperatorProps) {
  const {operator, onChange} = props;

  const options = React.useMemo<Array<SelectOption<PropertyFilterRuleGroupOperator>>>(() => ([
    { value: PropertyFilterRuleGroupOperator.And, label: UiComponents.translate("filterBuilder.operators.and") },
    { value: PropertyFilterRuleGroupOperator.Or, label: UiComponents.translate("filterBuilder.operators.or") },
  ]), []);

  return <div className="rule-group-operator">
    <Select options={options} value={operator} onChange={onChange} size="small" />
  </div>;
}
interface PropertyFilterBuilderGroupOrRuleProps {
  path: string[];
  item: PropertyFilterBuilderRuleGroupItem;
}

function PropertyFilterBuilderGroupOrRule({path, item}: PropertyFilterBuilderGroupOrRuleProps) {
  const itemPath = React.useMemo(() => ([...path, item.id]), [path, item]);

  if (isPropertyFilterBuilderRuleGroup(item))
    return <PropertyFilterBuilderRuleGroupRenderer path={itemPath} group={item} />;
  return <PropertyFilterBuilderRuleRenderer path={itemPath} rule={item} />;
}
