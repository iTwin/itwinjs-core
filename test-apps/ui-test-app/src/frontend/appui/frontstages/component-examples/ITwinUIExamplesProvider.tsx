/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Icon } from "@itwin/core-react";
import { Button, Checkbox, Input, LabeledInput, ProgressLinear, ProgressRadial, Radio, Select, Slider, ToggleSwitch } from "@itwin/itwinui-react";
import { ComponentExampleCategory } from "./ComponentExamples";
import { createComponentExample } from "./ComponentExamplesProvider";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";

// Hook
function useDebounce(value: any, delay=300) {
  // State and setters for debounced value
  const [debouncedValue, setDebouncedValue] = React.useState(value);
  React.useEffect(
    () => {
      // Update debounced value after delay
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      // Cancel the timeout if value changes (also on delay change or unmount)
      // This is how we prevent debounced value from updating if value is changed ...
      // .. within the delay period. Timeout gets cleared and restarted.
      return () => {
        clearTimeout(handler);
      };
    },
    [value, delay] // Only re-call effect if value or delay changes
  );
  return debouncedValue;
}

interface DateSliderProps {
  onChangeHandler: (date: Date) => void;
  timeStamp: Date;
}

interface TimeSliderProps {
  timeStamp: Date;
}

const YEAR = 2019;
const yearMin = new Date(YEAR, 0, 1).setHours(0, 0, 0, 0);
const yearMax = new Date(YEAR, 11, 31).setHours(0, 0, 0, 0);

const millisecPerMinute = 1000 * 60;
const millisecPerHour = millisecPerMinute * 60;
const millisecPerDay = millisecPerHour * 24;

const calculateSunriseOrSunset = (timeStamp: Date, sunrise: boolean) => {
  const year = timeStamp.getUTCFullYear();
  const month = timeStamp.getUTCMonth();
  const day = timeStamp.getUTCDay();
  const newDate = new Date(year, month, day);
  if (sunrise) {
    newDate.setHours(7, 0, 0, 0);
  } else {
    newDate.setHours(17, 0, 0, 0);
  }
  return newDate;
};

function TimeSlider({ timeStamp }: TimeSliderProps) {
  const sunrise = React.useMemo(
    () => calculateSunriseOrSunset(timeStamp, true).getTime(),
    [timeStamp],
  );
  const sunset = React.useMemo(
    () => calculateSunriseOrSunset(timeStamp, false).getTime(),
    [timeStamp],
  );

  const vals = React.useMemo(
    () => [Math.max(sunrise, Math.min(timeStamp.getTime(), sunset))],
    [timeStamp, sunrise, sunset],
  );

  if (vals[0] < sunrise || vals[0] > sunset) {
    // eslint-disable-next-line no-console
    console.log("timestamp is invalid", vals[0], sunrise, sunset);
  }

  return (
    <Slider
      min={sunrise}
      max={sunset}
      values={vals}
      // onUpdate={(value: readonly number[]) => {
      //   onChangeHandler(new Date(value[0]));
      // }}
      // onChange={(value: readonly number[]) => {
      //   onChangeHandler(new Date(value[0]));
      // }}
    />
  );
}

function DateSlider({ onChangeHandler, timeStamp }: DateSliderProps)  {
  const currentDate = React.useMemo(() => new Date(timeStamp.getTime()), [
    timeStamp,
  ]);

  const utcDate = React.useCallback(
    (value: number) => {
      // adjust the date passed in by the number of days passed in the slider
      const days =
          (new Date(value).getTime() - currentDate.getTime()) / millisecPerDay;
      const newDate = new Date(timeStamp.valueOf());
      newDate.setUTCDate(timeStamp.getUTCDate() + days);
      return newDate;
    },
    [timeStamp, currentDate],
  );

  return (
    <Slider
      min={yearMin}
      max={yearMax}
      values={[currentDate.getTime()]}
      onUpdate={(value: readonly number[]) => {
        onChangeHandler(utcDate(value[0]));
      }}
      onChange={(value: readonly number[]) => {
        onChangeHandler(utcDate(value[0]));
      }}
    />
  );
}

function DualDateSlider() {
  const [timeStamp, setTimeStamp] = React.useState(new Date(2019, 0, 1, 13));
  const debouncedTimeStamp = useDebounce(timeStamp, 60);
  return (
    <div style={{display: "flex", flexDirection: "column", flex: "1"}}>
      <TimeSlider timeStamp={debouncedTimeStamp} />
      <DateSlider
        onChangeHandler={(newDateTime) => setTimeStamp(newDateTime)}
        timeStamp={timeStamp}
      />
    </div>
  );
}

function WrappedSlider() {
  const [currentValues, setCurrentValues] = React.useState([50]);
  const handleValueChange = React.useCallback((values: readonly number[]) => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `Set slider value to ${values[0].toString()}`));
    setCurrentValues([...values]);
  }, []);

  // since right panel div is display `flex` and not `block` we must tell slider to fill available width
  const style: React.CSSProperties = { flex: "1" };

  return (
    <Slider style={style} min={0} max={100} values={currentValues} step={1} onChange={handleValueChange} />
  );
}

export class ITwinUIExamplesProvider {

  private static get iTwinUIComponentSamples(): ComponentExampleCategory {
    return {
      title: "iTwinUI-react",
      examples: [
        createComponentExample("Input", "iTwinUI Input component", <Input placeholder="Type..." className="uicore-full-width" size="small" />),
        createComponentExample("Check Box", undefined, <Checkbox label="Basic Check Box" />),
        createComponentExample("Radio Button", "Basic Radio Buttons",
          <div>
            <Radio label="Radio Button 1" name="demo1" value="option-1" />
            <Radio label="Radio Button 2" name="demo1" value="option-2" />
            <Radio label="Radio Button 3" name="demo1" value="option-3" />
          </div>),

        createComponentExample("Basic ToggleSwitch", undefined, <ToggleSwitch defaultChecked />),
        createComponentExample("Labeled ToggleSwitch", "Label Right", <ToggleSwitch defaultChecked label="This is a right label" labelPosition="right" />),
        createComponentExample("Labeled ToggleSwitch", "Label Left", <ToggleSwitch defaultChecked label="This is a left label" labelPosition="left" />),

        createComponentExample("Basic Button", "Button with cta", <Button styleType="cta">Primary Button</Button>),
        createComponentExample("Blue Button", "Button with high-visibility", <Button styleType="high-visibility">Blue Button</Button>),
        createComponentExample("Hollow Button", "Button with default", <Button styleType="default">Hollow Button</Button>),

        createComponentExample("Select with values", "Select with values in array",
          <Select value="option2"
            onChange={(newValue: string) => IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, newValue))}
            options={[
              { label: "Option 1", value: "option1" },
              { label: "Option 2", value: "option2" },
              { label: "Option 3", value: "option3" },
              { label: "Option 4", value: "option4" },
            ]}
            size="small" />),

        createComponentExample("ProgressRadial", "at 50%", <ProgressRadial value={50} />),
        createComponentExample("Indeterminate ProgressRadial", "indeterminate prop", <ProgressRadial indeterminate />),
        createComponentExample("ProgressRadial with value", "display value of 63", <ProgressRadial size="large" value={63}>63</ProgressRadial>),
        createComponentExample("ProgressLinear", "at 50%", <ProgressLinear value={50} className="uicore-full-width" />),
        createComponentExample("Indeterminate ProgressLinear", "indeterminate prop", <ProgressLinear indeterminate className="uicore-full-width" />),
        createComponentExample("Labeled Input", "Labeled Input component", <LabeledInput label="Labeled Input" placeholder="Labeled Input" className="uicore-full-width" size="small" />),
        createComponentExample("Labeled Input", "Labeled Input Icon", <LabeledInput label="Labeled Input with icon" placeholder="Labeled Input with Icon" status="positive" message="Positive message text" size="small" />),
        createComponentExample("Labeled Input Warning", "Labeled Input Warning", <LabeledInput label="Labeled Input Warning" placeholder="Labeled Input Warning" status="warning" message="Warning message text" size="small" />),
        createComponentExample("Labeled Input Error", "Labeled Input Error", <LabeledInput label="Labeled Input Error" placeholder="Labeled Input Error" status="negative" message="Error message text" size="small" />),
      ],
    };
  }

  private static get sliderSamples(): ComponentExampleCategory {
    // since right panel div is display `flex` and not `block` we must tell slider to fill available width
    const style: React.CSSProperties = { flex: "1" };

    return {
      title: "iTwinUI-react Slider",
      examples: [
        createComponentExample("Slider", "Basic Slider",
          <Slider style={style} min={0} max={100} values={[50]} step={1} minLabel="" maxLabel="" />),
        createComponentExample("Slider w/ tooltipBelow", "Slider with Tooltip Below",
          <Slider style={style} min={0} max={100} values={[50]} step={1} minLabel="" maxLabel=""
            tooltipProps={() => { return { placement: "bottom" }; }} />),
        createComponentExample("Slider w/ min/max", "Slider with prop",
          <Slider style={style} min={0} max={100} values={[50]} step={1} />),
        createComponentExample("Slider w/ min/max", "Slider with formatMax prop",
          <Slider style={style} min={0} max={1} values={[0.5]} step={0.01} maxLabel="1.0" />),
        createComponentExample("Slider w/ min/max images", "Slider with minImage and maxImage props",
          <Slider style={style} min={0} max={100} values={[50]} step={1}
            minLabel={<Icon iconSpec="icon-placeholder" />} maxLabel={<Icon iconSpec="icon-placeholder" />} />),
        createComponentExample("Slider w/ tick marks", "Slider with showTicks and getTickCount props",
          <Slider style={style} min={0} max={5} values={[2.25]} step={.01}
            tickLabels={["", "", "", "", "", "", "", "", "", "", ""]} />),
        createComponentExample("Slider w/ multiple values", "Slider with array of values",
          <Slider style={style} min={0} max={100} values={[30, 70]} step={5}
            tickLabels={["", "", "", "", "", "", "", "", "", "", ""]} />),
        createComponentExample("Slider multiple values tooltipBelow", "Slider with multiple values & tooltip below",
          <Slider style={style} min={0} max={100} values={[20, 80]} step={5} thumbMode="allow-crossing"
            tooltipProps={() => { return { placement: "bottom" }; }}
            tickLabels={["", "", "", "", "", "", "", "", "", "", ""]} />),
        createComponentExample("Slider w/ tick labels", "Slider with showTickLabels prop",
          <Slider style={style} min={0} max={100} values={[50]} step={1}
            tickLabels={["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]} />),
        createComponentExample("Disabled Slider", "Slider with disabled prop",
          <Slider style={style} min={0} max={100} values={[50]} step={1} disabled
            tickLabels={["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100"]} />),
        createComponentExample("Wrapped Slider", "Slider that reports changes", <WrappedSlider />),
        createComponentExample("Dual Date Sliders", "using iTwinUi Slider", <DualDateSlider />),
      ],
    };
  }

  public static get categories(): ComponentExampleCategory[] {
    return [
      ITwinUIExamplesProvider.iTwinUIComponentSamples,
      ITwinUIExamplesProvider.sliderSamples,
    ];
  }

}
