/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SelectableContent
 */

import * as React from "react";
import { useCallback, useState } from "react"; // tslint:disable-line: no-duplicate-imports
import "./SelectableContent.scss";

/**
 * A definition for content displayed in [[ControlledSelectableContent]] and
 * [[SelectableContent]] components.
 * @beta
 */
export interface SelectableContentDefinition {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

/**
 * [[ControlledSelectableContent]] component properties
 * @beta
 */
export interface ControlledSelectableContentProps {
  selectedContentId: string;
  onSelectedContentIdChanged?: (contentId: string) => void;
  children: SelectableContentDefinition[];
}

/**
 * A fully-controlled component that accepts a list of child components with ids and labels and
 * renders a select box at the top, allowing to choose which of the provided child components
 * should be rendered at the bottom.
 * @beta
 */
export function ControlledSelectableContent(props: ControlledSelectableContentProps) {
  const { onSelectedContentIdChanged } = props;
  const onContentIdSelected = useCallback((evt: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectedContentIdChanged && onSelectedContentIdChanged(evt.target.value);
  }, [onSelectedContentIdChanged]);
  const selectedContent = props.children.find((contentDef) => contentDef.id === props.selectedContentId) ?? props.children[0];
  return (
    <div className="components-selectable-content">
      <div className="components-selectable-content-header">
        <select className="components-selectable-content-selector" onChange={onContentIdSelected} value={selectedContent?.id}>
          {
            props.children.map((componentDef) =>
              <option key={componentDef.id} value={componentDef.id}>{componentDef.label}</option>)
          }
        </select>
      </div>
      <div className="components-selectable-content-wrapper">
        {selectedContent?.render()}
      </div>
    </div>
  );
}

/**
 * [[SelectableContent]] component properties
 * @beta
 */
export interface SelectableContentProps {
  defaultSelectedContentId: string;
  children: SelectableContentDefinition[];
}

/**
 * An uncontrolled component that accepts a list of child components with ids and labels and
 * renders a select box at the top, allowing to choose which of the provided child components
 * should be rendered at the bottom.
 * @beta
 */
export function SelectableContent(props: SelectableContentProps) {
  const [selectedContentId, setSelectedContentId] = useState(props.defaultSelectedContentId);
  const onSelectedContentIdChanged = useCallback((id: string) => {
    setSelectedContentId(id);
  }, []);
  return (
    <ControlledSelectableContent selectedContentId={selectedContentId} onSelectedContentIdChanged={onSelectedContentIdChanged}>
      {props.children}
    </ControlledSelectableContent>
  );
}
