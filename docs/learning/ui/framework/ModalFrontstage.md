# Modal Frontstages

A **Modal Frontstage** is accessed from another frontstage or the Backstage.
It may contain any content along with a Back button.
It does not use zones or stage panels.

The usual use-cases are for application settings and data management user interfaces.

## Definition of Modal Frontstage

The definition of a modal frontstage is in two parts: a [ModalFrontstageInfo]($appui-react) implementation and a React component.

```tsx
/** Modal frontstage. */
export class SampleModalFrontstage implements ModalFrontstageInfo {
  public title: string = UiFramework.i18n.translate("SampleApp:sampleModalFrontstage");

  public get content(): React.ReactNode {
    return <SampleModalPage />;
  }
}

/** SampleModalPage displaying a modal frontstage page. */
class SampleModalPage extends React.Component {
  public render(): React.ReactNode {
    return (
      <div>
        Hello World!
      </div>
    );
  }
}

```

## Code to Open Modal Frontstage

The following code instantiates a modal frontstage and calls `FrontstageManager.openModalFrontstage` to open the modal frontstage.

```ts
const modalFrontstage = new SampleModalFrontstage();
FrontstageManager.openModalFrontstage(modalFrontstage);
```

## API Reference

- [ModalFrontstage]($appui-react)
- [ModalFrontstageInfo]($appui-react)
- [FrontstageManager]($appui-react)
- [Frontstage]($appui-react:Frontstage)
