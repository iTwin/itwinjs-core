/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { SvgAdd, SvgDelete } from "@itwin/itwinui-icons-react";
import { Button, IconButton, Select, SelectOption } from "@itwin/itwinui-react";
import { UiComponents } from "../UiComponents";
import { PropertyFilterBuilderContext } from "./FilterBuilder";
import { PropertyFilterBuilderRuleRenderer } from "./FilterBuilderRule";
import { isPropertyFilterBuilderRuleGroup, PropertyFilterBuilderRuleGroup, PropertyFilterBuilderRuleGroupItem } from "./FilterBuilderState";
import { PropertyFilterRuleGroupOperator } from "./Operators";
import "./FilterBuilderRuleGroup.scss";

/** @alpha */
export interface ActiveRuleGroupContextProps {
  activeElement: HTMLElement | undefined;
  onFocus: React.FocusEventHandler<HTMLElement>;
  onBlur: React.FocusEventHandler<HTMLElement>;
  onMouseOver: React.MouseEventHandler<HTMLElement>;
  onMouseOut: React.MouseEventHandler<HTMLElement>;
}

/** @alpha */
export const ActiveRuleGroupContext = React.createContext<ActiveRuleGroupContextProps>(null!);

/** @alpha */
export interface PropertyFilterBuilderRuleGroupRendererProps {
  path: string[];
  group: PropertyFilterBuilderRuleGroup;
}

/** @alpha */
export function PropertyFilterBuilderRuleGroupRenderer(props: PropertyFilterBuilderRuleGroupRendererProps) {
  const { path, group } = props;
  const { actions, ruleGroupDepthLimit } = React.useContext(PropertyFilterBuilderContext);
  const groupRef = React.useRef<HTMLDivElement>(null);

  const addRule = () => actions.addItem(path, "RULE");
  const addRuleGroup = () => actions.addItem(path, "RULE_GROUP");
  const removeGroup = () => actions.removeItem(path);

  const onOperatorChange = React.useCallback((operator) => {
    actions.setRuleGroupOperator(path, operator);
  }, [path, actions]);

  const allowToAddGroup = ruleGroupDepthLimit === undefined || path.length < ruleGroupDepthLimit;
  const { activeElement, ...eventHandlers } = React.useContext(ActiveRuleGroupContext);

  const showOperator = group.items.length > 1;

  return <div
    ref={groupRef}
    className="rule-group"
    data-isactive={groupRef.current === activeElement}
    {...eventHandlers}
  >
    <div className="rule-group-remove-action">
      {group.groupId !== undefined && <IconButton data-testid="rule-group-remove" onClick={removeGroup} styleType="borderless" size="small"><SvgDelete /></IconButton>}
    </div>
    <div className="rule-group-content">
      {showOperator ? <PropertyFilterBuilderRuleGroupOperator operator={group.operator} onChange={onOperatorChange} /> : null}
      <div className="rule-group-items">
        {group.items.map((item) => <PropertyFilterBuilderGroupOrRule key={item.id} path={path} item={item} />)}
      </div>
      <div className="rule-group-actions">
        <Button key="add-rule-button" data-testid="rule-group-add-rule" onClick={addRule} styleType="borderless" size="small" startIcon={<SvgAdd />}>
          {UiComponents.translate("filterBuilder.rule")}
        </Button>
        {allowToAddGroup && <Button key="add-rule-group-button" data-testid="rule-group-add-rule-group" onClick={addRuleGroup} styleType="borderless" size="small" startIcon={<SvgAdd />}>
          {UiComponents.translate("filterBuilder.ruleGroup")}
        </Button>}
      </div>
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
  const { operator, onChange } = props;

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

const PropertyFilterBuilderGroupOrRule = React.memo(
  function PropertyFilterBuilderGroupOrRule({ path, item }: PropertyFilterBuilderGroupOrRuleProps) {
    const itemPath = [...path, item.id];

    if (isPropertyFilterBuilderRuleGroup(item))
      return <PropertyFilterBuilderRuleGroupRenderer path={itemPath} group={item} />;
    return <PropertyFilterBuilderRuleRenderer path={itemPath} rule={item} />;
  }
);
