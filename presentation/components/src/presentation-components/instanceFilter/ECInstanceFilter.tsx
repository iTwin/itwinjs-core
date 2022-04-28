/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { PropertyDescription } from "@itwin/appui-abstract";
import { Checkbox, ComboBox, DropdownMenu, IconButton, Label, MenuItem, SelectOption, Tag } from "@itwin/itwinui-react";
import { ClassId, ClassInfo } from "@itwin/presentation-common";
import "./ECInstanceFilter.scss";
import { Filter, FilterBuilder } from "@itwin/components-react";
import { SvgMore } from "@itwin/itwinui-icons-react";
import { useResizeObserver } from "@itwin/core-react";
import { useMergedRefs } from "@itwin/itwinui-react/cjs/core/utils";

export interface ECInstanceFilterBuilderProps {
  selectedClasses: ClassInfo[];
  classes: ClassInfo[];
  properties: PropertyDescription[];
  onFilterChanged: (filter?: Filter) => void;
  onPropertySelected: (property: PropertyDescription) => void;
  onClassSelected: (selectedClass: ClassInfo) => void;
  onClassDeSelected: (selectedClass: ClassInfo) => void;
  onClearClasses: () => void;
}

const ALL_CLASSES_OPTION_VALUE = "ALL_CLASSES";

export function ECInstanceFilterBuilder(props: ECInstanceFilterBuilderProps) {
  const {selectedClasses, classes, properties, onFilterChanged, onPropertySelected, onClassSelected, onClassDeSelected, onClearClasses} = props;
  const classOptions = React.useMemo(() => {
    return [{label: "All Classes", value: ALL_CLASSES_OPTION_VALUE},
      ...classes.map((classInfo) => ({label: classInfo.label, value: classInfo.id}))];
  }, [classes]);

  // work around for ComboBox not updating passed `onChange` callback and always using first captured version
  const handleClassChangeRef = useCallbackRef((classId: ClassId) => {
    console.log(`ComboBox.onChange: ${classId}`);
    if (classId === ALL_CLASSES_OPTION_VALUE) {
      onClearClasses();
      return;
    }

    const selectedClass = classes.find((classInfo) => classInfo.id === classId);
    if (!selectedClass)
      return;

    const isClassSelected = selectedClasses.find((classInfo) => classInfo.id === classId) !== undefined;
    const onChange = isClassSelected ? onClassDeSelected : onClassSelected;
    onChange(selectedClass);
  });

  const classSelectItemRenderer = React.useCallback((option: SelectOption<string>) => {
    const selected = selectedClasses.find((selectedClass) => selectedClass.id === option.value) !== undefined;
    return (
      <MenuItem isSelected={false} value={option.value}>
        <Checkbox
          label={option.label}
          checked={selected}
          readOnly={true}
        />
      </MenuItem>);
  }, [selectedClasses]);

  return <div className="presentation-instance-filter">
    <div className="presentation-instance-filter-class-selector">
      <Label htmlFor="class-combo-input">
        Classes
      </Label>
      <ComboBox
        inputProps={{ id: "class-combo-input", value: undefined }}
        options={classOptions}
        onChange={(classId) => handleClassChangeRef.current(classId)}
        value={undefined}
        itemRenderer={classSelectItemRenderer}
      />
    </div>
    <div className="presentation-instance-filter-selected-classes">
      <LimitedTagContainer>
        {selectedClasses.map((selectedClass) => {
          return <Tag key={selectedClass.id} onRemove={() => onClassDeSelected(selectedClass)}>{selectedClass.label}</Tag>;
        })}
      </LimitedTagContainer>
    </div>
    <FilterBuilder properties={properties} onFilterChanged={onFilterChanged} onRulePropertySelected={onPropertySelected}/>
  </div>;
}

function useCallbackRef<T>(callback: (args: T) => void) {
  const ref = React.useRef<(args: T) => void>(callback);
  React.useEffect(() => {
    ref.current = callback;
  }, [callback]);
  return ref;
}

interface LimitedTagContainerProps {
  children: JSX.Element[];
}

function LimitedTagContainer(props: LimitedTagContainerProps) {
  const {children} = props;

  const items = React.useMemo(() => React.Children.map(children, (child) => child), [children]);

  const {overflowRef, visibleCount} = useVisibleOverflow(items);
  const containerOverflow = visibleCount < items.length;

  return (
    <div className="iui-tag-container" ref={overflowRef}>
      {containerOverflow ? (
        <>
          {items.slice(0, visibleCount - 1)}

          <div className="iui-tag" style={{display: "inline-block"}}>
            <DropdownMenu
              menuItems={() => items.slice(visibleCount - 1)}
            >
              <IconButton
                styleType="borderless"
                size="small"
                style={{height: "33px"}}>
                <SvgMore />
              </IconButton>
            </DropdownMenu>
          </div>
        </>
      ) : items}
    </div>
  );
}

interface Size {
  width: number;
  height: number;
}

function useVisibleOverflow(items: React.ReactNode[]) {
  const containerRef = React.useRef<HTMLElement>(null);
  const [size, setSize] = React.useState<Size>({width: 0, height: 0});

  const [visibleCount, setVisibleCount] = React.useState(items.length);

  const updateSize = React.useCallback((width: number, height: number) => {
    setSize({width, height});
  }, []);

  const resizeRef = useResizeObserver(updateSize);
  const renderAllItems = React.useRef(true);

  React.useLayoutEffect(() => {
    setVisibleCount(items.length);
    renderAllItems.current = true;
  }, [items]);

  React.useLayoutEffect(() => {
    if (!containerRef.current)
      return;

    if (!renderAllItems.current) {
      let highestItem = 0;

      for (let i = 0; i < containerRef.current.children.length; i++) {
        const child = containerRef.current.children[i] as HTMLElement;
        const childTopOffset = child.offsetTop - (containerRef.current?.offsetTop ?? 0);
        if (child.offsetHeight > highestItem) {
          highestItem = child.offsetHeight;
        }

        if (childTopOffset >= highestItem * 3) {
          setVisibleCount(i);
          break;
        }
      }
    }

    renderAllItems.current = false;
  }, [size, visibleCount, items]);

  return {overflowRef: useMergedRefs(containerRef, resizeRef), visibleCount};
}
