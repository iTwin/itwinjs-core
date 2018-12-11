/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import * as React from "react";

import { getDisplayName } from "@bentley/ui-core";
import { DropTargetArguments, DragSourceArguments, DropTargetProps, DragSourceProps } from "../../dragdrop/DragDropDef";
import { BreadcrumbProps, BreadcrumbNode, BreadcrumbNodeProps } from "../Breadcrumb";
import { TreeNodeItem } from "../../tree/TreeDataProvider";
import { TreeDragDropType } from "../../tree/hocs/withDragDrop";
import { DragDropBreadcrumbNode } from "./DragDropBreadcrumbNode";

/**
 * Props that are injected to the HOC component.
 */
export interface BreadcrumbDragDropProps<DragDropObject = any> {
  dragProps?: DragSourceProps<DragDropObject>;
  dropProps?: DropTargetProps<DragDropObject>;
}

/**
 * A HOC component that adds drag and drop functionality to the supplied
 * breadcrumb component.
 */
// tslint:disable-next-line: variable-name naming-convention
export function withBreadcrumbDragDrop<P extends BreadcrumbProps, DragDropObject extends TreeDragDropType>(BreadcrumbComponent: React.ComponentType<P>): React.ComponentType<P & BreadcrumbDragDropProps<DragDropObject>> {

  type CombinedProps = P & BreadcrumbDragDropProps<DragDropObject>;

  // tslint:disable-next-line:variable-name
  return class WithDragAndDrop extends React.Component<CombinedProps> {

    public static get displayName() { return `WithDragDrop(${getDisplayName(BreadcrumbComponent)})`; }

    private createNodeDragProps(item?: TreeNodeItem, parent?: TreeNodeItem): DragSourceProps<DragDropObject> {
      if (!item)
        return {};
      if (!this.props.dragProps)
        return {};

      const { onDragSourceBegin, onDragSourceEnd, objectType } = this.props.dragProps as any;
      const dragProps: DragSourceProps<DragDropObject> = {
        onDragSourceBegin: (args: DragSourceArguments<DragDropObject>) => {
          args.dataObject = item as DragDropObject;
          args.parentObject = (parent || this.props.dataProvider) as DragDropObject;
          return onDragSourceBegin ? onDragSourceBegin(args) : args;
        },
        onDragSourceEnd: (args: DragSourceArguments<DragDropObject>) => {
          if (onDragSourceEnd) {
            args.parentObject = (parent || this.props.dataProvider) as DragDropObject;
            onDragSourceEnd(args);
          }
        },
        objectType: () => {
          if (objectType) {
            if (typeof objectType === "function") {
              return objectType(item.extendedData as DragDropObject);
            } else
              return objectType;
          }
          return "";
        },
      };
      return dragProps;
    }

    private createNodeDropProps(item?: TreeNodeItem): DropTargetProps<DragDropObject> {
      if (!this.props.dropProps)
        return {};
      const { onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes } = this.props.dropProps as any;
      const dropProps = {
        onDropTargetDrop: (args: DropTargetArguments<DragDropObject>): DropTargetArguments<DragDropObject> => {
          args.dropLocation = (item || this.props.dataProvider) as DragDropObject;
          return onDropTargetDrop ? onDropTargetDrop(args) : args;
        },
        onDropTargetOver: (args: DropTargetArguments<DragDropObject>) => {
          if (onDropTargetOver) {
            args.dropLocation = (item || this.props.dataProvider) as DragDropObject;
            onDropTargetOver(args);
          }
        },
        canDropTargetDrop: (args: DropTargetArguments<DragDropObject>) => {
          args.dropLocation = (item || this.props.dataProvider) as DragDropObject;
          return canDropTargetDrop ? canDropTargetDrop(args) : true;
        },
        objectTypes,
      };
      return dropProps;
    }
    // tslint:disable-next-line:naming-convention
    private renderNode = (props: BreadcrumbNodeProps, node?: TreeNodeItem, parent?: TreeNodeItem): React.ReactNode => {
      const baseNode = this.props.renderNode ? this.props.renderNode(props, node) : <BreadcrumbNode {...props} />;
      const DDBreadcrumbNode = DragDropBreadcrumbNode<DragDropObject>(); // tslint:disable-line:variable-name
      return (
        <DDBreadcrumbNode
          key={(node && node.id) || "root"}
          dragProps={this.createNodeDragProps(node, parent)}
          dropProps={this.createNodeDropProps(node)}>
          {baseNode}
        </DDBreadcrumbNode>
      );
    }

    public render() {
      const { dragProps, dropProps, renderNode, ...treeProps } = this.props as any;
      return (
        <BreadcrumbComponent {...treeProps}
          renderNode={this.renderNode} />
      );
    }
  };
}
export default withBreadcrumbDragDrop;
