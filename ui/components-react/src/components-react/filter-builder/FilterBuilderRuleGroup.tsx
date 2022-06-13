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
import "./FilterBuilderRuleGroup.scss";

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

  const { active, eventHandlers } = useIsActive();

  return <div
    className="rule-group"
    data-isactive={active}
    {...eventHandlers}
  >
    <div className="rule-group-remove-action">
      {group.groupId !== undefined && <IconButton data-testid="rule-group-remove" onClick={removeGroup} styleType="borderless" size="small"><SvgDelete /></IconButton>}
    </div>
    <div className="rule-group-content">
      <PropertyFilterBuilderRuleGroupOperator operator={group.operator} onChange={onOperatorChange}/>
      <div className="rule-group-items">
        {group.items.map((item) => <PropertyFilterBuilderGroupOrRule key={item.id} path={path} item={item} />)}
      </div>
      <div className="rule-group-actions">
        <ButtonGroup>
          <Button data-testid="rule-group-add-rule" onClick={addRule} styleType="default" size="small" startIcon={<SvgAdd />} disabled={!active}>
            {UiComponents.translate("filterBuilder.rule")}
          </Button>
          <Button data-testid="rule-group-add-rule-group" onClick={addRuleGroup} styleType="default" size="small" startIcon={<SvgAdd />} disabled={!active}>
            {UiComponents.translate("filterBuilder.ruleGroup")}
          </Button>
        </ButtonGroup>
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

const PropertyFilterBuilderGroupOrRule = React.memo(
  function PropertyFilterBuilderGroupOrRule({path, item}: PropertyFilterBuilderGroupOrRuleProps) {
    const itemPath = [...path, item.id];

    if (isPropertyFilterBuilderRuleGroup(item))
      return <PropertyFilterBuilderRuleGroupRenderer path={itemPath} group={item} />;
    return <PropertyFilterBuilderRuleRenderer path={itemPath} rule={item} />;
  }
);

function useIsActive() {
  const { isFocused, onBlur, onFocus } = useIsFocused();
  const { isHovered, onMouseOver, onMouseOut } = useIsHovered();
  const active = isHovered || isFocused;

  return {
    active,
    eventHandlers: {
      onMouseOver,
      onMouseOut,
      onFocus,
      onBlur,
    },
  };
}

function useIsHovered() {
  const [isHovered, setIsHovered] = React.useState(false);

  const onMouseOver: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    setIsHovered(true);
  };

  const onMouseOut: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    setIsHovered(false);
  };

  return { isHovered, onMouseOver, onMouseOut };
}

function useIsFocused() {
  const [isFocused, setIsFocused] = React.useState(false);
  const timeout = React.useRef<any>();

  React.useEffect(() => () => clearTimeout(timeout.current), []);

  const onFocus: React.FocusEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    clearTimeout(timeout.current);
    timeout.current = undefined;
    setIsFocused(true);
  };

  const onBlur: React.FocusEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    // need to handle onBlur on the next tick to check if other child of element
    // received onFocus event
    timeout.current = setTimeout(() => {
      setIsFocused(false);
      timeout.current = undefined;
    });
  };

  return { isFocused, onFocus, onBlur };
}
