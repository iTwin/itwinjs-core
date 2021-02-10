# UIDataProvider

The [UiDataProvider]($ui-abstract:Dialog) sets up data synchronization for apps that wish to develop their UI directly in React.

As an abstract class, the app must extend it with a class in their own app:

```ts
export class MyUiProvider extends UiDataProvider {}
```

UiDataProvider relies on the app to provide an array of [DialogPropertyItem]($ui-abstract:Dialog) to communicate with the UI. To set this up, the app defines supplyAvailableProperties() to return the array of DialogPropertyItem interfaces:

```ts
public supplyAvailableProperties(): DialogPropertyItem[] {
  return [
    { value: { value: this.currentAnimationType as number }, propertyName: this.currentAnimationTypePropertyName },
    { value: { value: this.monitorMode }, propertyName: this.monitorModePropertyName },
    { value: { value: this.startTime }, propertyName: this.startTimePropertyName },
    { value: { value: this.endTime }, propertyName: this.endTimePropertyName },
    { value: { value: this.monitorTime }, propertyName: this.monitorTimePropertyName },
    { value: { value: this.minDate }, propertyName: this.minDatePropertyName },
    { value: { value: this.maxDate }, propertyName: this.maxDatePropertyName },
    { value: { value: this.alarmText }, propertyName: this.alarmTextPropertyName },
  ];
}
```

The method processChangesInUi() notifies the dataProvider that the UI has changed. This is usually called from the OK handler in a modal dialog. Here's an example of the processChangesInUi method that goes with the supplyAvailableProperties example above:

```ts
public processChangesInUi(properties: DialogPropertyItem[]): PropertyChangeResult {
  if (properties.length > 0) {
    for (const prop of properties) {
      if (prop.propertyName === this.currentAnimationTypePropertyName) {
        this.currentAnimationType = this.getAnimationType(prop.value.value! as number);
        continue;
      }
      if (prop.propertyName === this.monitorModePropertyName) {
        this.monitorMode = prop.value.value! as boolean;
        continue;
      }
      if (prop.propertyName === this.startTimePropertyName) {
        this.startTime = (prop.value.value! as Date);
        continue;
      }
      if (prop.propertyName === this.endTimePropertyName) {
        this.endTime = (prop.value.value! as Date);
        continue;
      }
    }
  }

  if (this.monitorMode) {
    this.extension.runMonitor(this.currentAnimationType);
    return { status: PropertyChangeStatus.Success };
  } else {
    // get duration in minutes.
    let duration: number = (this.endTime.getTime() - this.startTime.getTime()) / (60.0 * 1000.0);
    if (duration < 10)
      duration = 10;
    this.extension.runAnimation(this.currentAnimationType, duration, this.startTime.getTime());
    return { status: PropertyChangeStatus.Success };
  }
}
```

## API Reference

- [UiDataProvider]($ui-abstract:Dialog)
