/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

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
}

/** @alpha */
export interface DataList {
  list: HTMLDataListElement;
  div: HTMLDivElement;
}

function _appendDataListEntry(list: HTMLDataListElement, entry: DataListEntry) {
  const option = document.createElement("option") as HTMLOptionElement;
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
  const list = document.createElement("datalist") as HTMLDataListElement;
  list.id = props.id;

  for (const entry of props.entries) {
    _appendDataListEntry(list, entry);
  }

  const handler = props.handler;
  if (undefined !== handler)
    list.onselect = () => handler(list);

  const div = document.createElement("div");
  div.appendChild(list);
  if (undefined !== props.parent)
    props.parent.appendChild(div);

  return { div, list };
}
