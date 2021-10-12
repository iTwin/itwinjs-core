/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Controls
 */

/** @alpha */
export interface DataListEntry {
  value: number | string | undefined;
}

/** @alpha */
export type DataListHandler = (list: HTMLDataListElement) => void;

/** @alpha */
export interface DataListProps {
  name?: string;
  id: string;
  entries: DataListEntry[];
  parent?: HTMLElement;
  handler?: DataListHandler;
  inline?: boolean;
}

/** @alpha */
export interface DataList {
  list: HTMLDataListElement;
  div: HTMLDivElement;
}

function _appendDataListEntry(list: HTMLDataListElement, entry: DataListEntry) {
  const option = document.createElement("option");
  if (undefined !== entry.value)
    option.value = entry.value.toString();
  list.appendChild(option);
}

/** @alpha */
export function appendDataListEntries(dl: DataList, entries: DataListEntry[]) {
  for (const entry of entries) {
    _appendDataListEntry(dl.list, entry);
  }
}

/** @alpha */
export function createDataList(props: DataListProps): DataList {
  const list = document.createElement("datalist");
  list.id = props.id;

  for (const entry of props.entries) {
    _appendDataListEntry(list, entry);
  }

  const handler = props.handler;
  if (undefined !== handler)
    list.onselect = () => handler(list);

  const div = document.createElement("div");
  if (props.inline)
    div.style.display = "inline";

  div.appendChild(list);
  if (undefined !== props.parent)
    props.parent.appendChild(div);

  return { div, list };
}
