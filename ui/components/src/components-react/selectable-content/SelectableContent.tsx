/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module SelectableContent
 */

import "./SelectableContent.scss";
import * as React from "react";
import { ActionMeta, ValueType } from "react-select/src/types";
import { OptionType, ThemedSelect } from "@itwin/core-react";

/**
 * A definition for content displayed in [[ControlledSelectableContent]] and
 * [[SelectableContent]] components.
 * @public
 */
export interface SelectableContentDefinition {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

/**
 * [[ControlledSelectableContent]] component properties
 * @public
 */
export interface ControlledSelectableContentProps {
  selectedContentId: string;
  onSelectedContentIdChanged?: (contentId: string) => void;
  children: SelectableContentDefinition[];
  selectAriaLabel?: string;
}

/**
 * A fully-controlled component that accepts a list of child components with ids and labels and
 * renders a select box at the top, allowing to choose which of the provided child components
 * should be rendered at the bottom.
 * @public
 */
export function ControlledSelectableContent(props: ControlledSelectableContentProps) {
  const { onSelectedContentIdChanged } = props;
  const onContentIdSelected = React.useCallback((value: ValueType<OptionType>, action: ActionMeta<OptionType>) => {
    onSelectedContentIdChanged && action.action === "select-option" && value && onSelectedContentIdChanged((value as OptionType).value);
  }, [onSelectedContentIdChanged]);
  const selectedContent = props.children.find((contentDef) => contentDef.id === props.selectedContentId) ?? props.children[0];
  return (
    <div className="components-selectable-content">
      <div className="components-selectable-content-header">
        <ThemedSelect openMenuOnClick={true} openMenuOnFocus={true} isSearchable={false} onChange={onContentIdSelected}
          className="components-selectable-content-selector"
          aria-label={props.selectAriaLabel}
          value={{ label: selectedContent?.label, value: selectedContent?.id }}
          options={props.children.map((componentDef) => ({
            label: componentDef.label,
            value: componentDef.id,
          }))}
        />
      </div>
      <div className="components-selectable-content-wrapper">
        {selectedContent?.render()}
      </div>
    </div>
  );
}

/**
 * [[SelectableContent]] component properties
 * @public
 */
export interface SelectableContentProps {
  defaultSelectedContentId: string;
  children: SelectableContentDefinition[];
  selectAriaLabel?: string;
}

/**
 * An uncontrolled component that accepts a list of child components with ids and labels and
 * renders a select box at the top, allowing to choose which of the provided child components
 * should be rendered at the bottom.
 * @public
 */
export function SelectableContent(props: SelectableContentProps) {
  const [selectedContentId, setSelectedContentId] = React.useState(props.defaultSelectedContentId);
  const onSelectedContentIdChanged = React.useCallback((id: string) => {
    setSelectedContentId(id);
  }, []);
  return (
    <ControlledSelectableContent selectedContentId={selectedContentId} onSelectedContentIdChanged={onSelectedContentIdChanged} selectAriaLabel={props.selectAriaLabel}>
      {props.children}
    </ControlledSelectableContent>
  );
}
