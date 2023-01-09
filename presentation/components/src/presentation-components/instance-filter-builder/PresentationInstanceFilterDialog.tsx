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

/** @alpha */
export interface PresentationInstanceFilterDialogProps extends Omit<PresentationInstanceFilterBuilderProps, "onInstanceFilterChanged" | "descriptor"> {
  isOpen: boolean;
  onApply: (filter: PresentationInstanceFilterInfo) => void;
  onClose: () => void;
  descriptor: (() => Promise<Descriptor>) | Descriptor;
  filterResultCountRenderer?: (filter?: PresentationInstanceFilterInfo) => React.ReactNode;
  title?: React.ReactNode;
}

/** @alpha */
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
  const descriptor = useLazyDescriptor(descriptorGetter);
  if (!descriptor)
    return <DelayedCenteredProgressRadial />;

  return <PresentationInstanceFilterBuilder
    {...restProps}
    descriptor={descriptor}
  />;
}

function useLazyDescriptor(descriptorGetter: () => Promise<Descriptor>) {
  const [descriptor, setDescriptor] = React.useState<Descriptor>();

  React.useEffect(() => {
    let disposed = false;
    void (async () => {
      const newDescriptor = await descriptorGetter();
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
    return () => { clearTimeout(timeout); }
  }, []);

  if (!show)
    return null;
  return (
    <div className="presentation-instance-filter-progress">
      <ProgressRadial indeterminate={true} size="large" />
    </div>
  );
}
