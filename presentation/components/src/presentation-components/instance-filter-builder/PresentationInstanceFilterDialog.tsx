/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module InstancesFilter
 */

import "./PresentationInstanceFilterDialog.scss";
import * as React from "react";
import { Button, Dialog, ProgressRadial } from "@itwin/itwinui-react";
import { Descriptor } from "@itwin/presentation-common";
import { translate } from "../common/Utils";
import {
  PresentationInstanceFilterBuilder, PresentationInstanceFilterBuilderProps, PresentationInstanceFilterInfo,
} from "./PresentationInstanceFilterBuilder";

/**
 * Props for [[PresentationInstanceFilterDialog]] component.
 * @beta
 */
export interface PresentationInstanceFilterDialogProps extends Omit<PresentationInstanceFilterBuilderProps, "onInstanceFilterChanged" | "descriptor"> {
  /** Specifies whether dialog is open or not. */
  isOpen: boolean;
  /** Callback that is invoked when 'Apply' button is clicked. */
  onApply: (filter: PresentationInstanceFilterInfo) => void;
  /** Callback that is invoked when 'Close' button is clicked or dialog is closed. */
  onClose: () => void;
  /**
   * [Descriptor]($presentation-common) that will be used in [[PresentationInstanceFilterBuilder]] component rendered inside this dialog.
   *
   * This property can be set to function in order to lazy load [Descriptor]($presentation-common) when dialog is opened.
   */
  descriptor: (() => Promise<Descriptor>) | Descriptor;
  /** Renderer that renders count of results for currently built filter. */
  filterResultCountRenderer?: (filter?: PresentationInstanceFilterInfo) => React.ReactNode;
  /** Dialog title. */
  title?: React.ReactNode;
}

/**
 * Dialog component that renders [[PresentationInstanceFilterBuilder]] inside.
 * @beta
 */
export function PresentationInstanceFilterDialog(props: PresentationInstanceFilterDialogProps) {
  const { isOpen, onApply, onClose, filterResultCountRenderer, title, descriptor, ...restProps } = props;
  const [filter, setFilter] = React.useState<PresentationInstanceFilterInfo>();

  const onInstanceFilterChanged = React.useCallback((filterInfo?: PresentationInstanceFilterInfo) => {
    setFilter(filterInfo);
  }, []);

  const applyButtonHandle = () => {
    filter && onApply(filter);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeOnEsc={false}
      preventDocumentScroll={true}
      trapFocus={true}
    >
      <Dialog.Backdrop />
      <Dialog.Main className="presentation-instance-filter-dialog">
        <Dialog.TitleBar
          className="presentation-instance-filter-title"
          titleText={title ? title : translate("instance-filter-builder.filter")}
        />
        <Dialog.Content className="presentation-instance-filter-content">
          {descriptor instanceof Descriptor
            ? <PresentationInstanceFilterBuilder {...restProps} descriptor={descriptor} onInstanceFilterChanged={onInstanceFilterChanged} />
            : <DelayLoadedPresentationInstanceFilterBuilder {...restProps} onInstanceFilterChanged={onInstanceFilterChanged} descriptorGetter={descriptor} />
          }
        </Dialog.Content>
        <div className="presentation-instance-filter-dialog-bottom-container">
          <div>{filterResultCountRenderer && filterResultCountRenderer(filter)}</div>
          <Dialog.ButtonBar className="presentation-instance-filter-button-bar">
            <Button
              className="presentation-instance-filter-dialog-apply-button"
              styleType='high-visibility'
              onClick={applyButtonHandle}
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
    </Dialog>
  );
}

interface DelayLoadedPresentationInstanceFilterBuilderProps extends Omit<PresentationInstanceFilterBuilderProps, "descriptor"> {
  descriptorGetter: () => Promise<Descriptor>;
}

function DelayLoadedPresentationInstanceFilterBuilder(props: DelayLoadedPresentationInstanceFilterBuilderProps) {
  const { descriptorGetter, ...restProps } = props;
  const descriptor = useDelayLoadedDescriptor(descriptorGetter);
  if (!descriptor)
    return <DelayedCenteredProgressRadial />;

  return <PresentationInstanceFilterBuilder
    {...restProps}
    descriptor={descriptor}
  />;
}

function useDelayLoadedDescriptor(descriptorGetter: () => Promise<Descriptor>) {
  const [descriptor, setDescriptor] = React.useState<Descriptor>();

  React.useEffect(() => {
    let disposed = false;
    void (async () => {
      const newDescriptor = await descriptorGetter();
      // istanbul ignore else
      if (!disposed)
        setDescriptor(newDescriptor);
    })();
    return () => { disposed = true; };
  }, [descriptorGetter]);

  return descriptor;
}

function DelayedCenteredProgressRadial() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setShow(true);
    }, 250);
    return () => { clearTimeout(timeout); };
  }, []);

  if (!show)
    return null;
  return (
    <div className="presentation-instance-filter-dialog-progress">
      <ProgressRadial indeterminate={true} size="large" />
    </div>
  );
}
