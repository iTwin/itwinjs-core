/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */
import * as React from "react";
import { Button, Dialog } from "@itwin/itwinui-react";
import { PresentationInstanceFilterBuilder, PresentationInstanceFilterBuilderProps, PresentationInstanceFilterInfo } from "./PresentationInstanceFilterBuilder";
import "./PresentationInstanceFilterDialog.scss";
import { translate } from "../common/Utils";

interface PresentationInstanceFilterDialogProps extends Omit<PresentationInstanceFilterBuilderProps, "onInstanceFilterChanged"> {
  onApply: (filter?: PresentationInstanceFilterInfo) => void;
  onClose: () => void;
  filterResultCountRenderer?: (filter?: PresentationInstanceFilterInfo) => React.ReactNode;
  title?: React.ReactNode;
  isOpen: boolean;
}

/** @alpha */
export function PresentationInstanceFilterDialog(props: PresentationInstanceFilterDialogProps) {
  const { isOpen, onApply, onClose, filterResultCountRenderer, title, ...restProps } = props;
  const [filter, setFilter] = React.useState<PresentationInstanceFilterInfo | undefined>(() => restProps.initialFilter);

  const onInstanceFilterChanged = React.useCallback((filterInfo?: PresentationInstanceFilterInfo) => {
    setFilter(filterInfo);
  }, []);

  const applyButtonHandle = () => {
    onApply(filter);
  };

  return <Dialog
    isOpen={isOpen}
    onClose={onClose}
    closeOnEsc={false}
    preventDocumentScroll={true}
    trapFocus={true}>
    <Dialog.Backdrop
    />
    <Dialog.Main className="presentation-instance-filter-dialog">
      <Dialog.TitleBar
        className="presentation-instance-filter-title"
        titleText={title ? title : translate("instance-filter-builder.filter")}
      />
      <Dialog.Content className="presentation-instance-filter-content">
        <PresentationInstanceFilterBuilder
          {...restProps}
          onInstanceFilterChanged={onInstanceFilterChanged}
        />
      </Dialog.Content>
      <div className="presentation-instance-filter-dialog-bottom-container">
        <div>{filterResultCountRenderer && filterResultCountRenderer(filter)}</div>
        <Dialog.ButtonBar className="presentation-instance-filter-button-bar">
          <Button
            className="presentation-instance-filter-dialog-apply-button"
            styleType='high-visibility' onClick={applyButtonHandle}
            disabled={!filter}
          >
            {translate("instance-filter-builder.apply")}
          </Button>
          <Button
            className="presentation-instance-filter-dialog-close-button"
            onClick={onClose}
          >
            {translate("instance-filter-builder.cancel")}
          </Button>
        </Dialog.ButtonBar>
      </div>
    </Dialog.Main>
  </Dialog >;
}
