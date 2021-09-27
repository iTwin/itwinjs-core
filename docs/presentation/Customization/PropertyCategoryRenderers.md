# Custom property category renderers

This page explains how to leverage custom category renderers to create fully customizable property categories for [VirtualizedPropertyGrid]($components-react).

## Defining a custom category

To make use of custom category rendering system, we will need to define a custom category and assign it a renderer with Presentation Rules. This is achievable using [PropertyCategorySpecification](../Content/PropertyCategorySpecification.md):

```json
...
  },
  "propertyCategories": [
    {
      "id": "my_custom_category",
      "label": "My Custom Category",
      "renderer": {
        "rendererName": "my_custom_renderer"
      }
    },
...
```

Now when `my_custom_category` is expanded, `my_custom_renderer` will be invoked to render properties assigned to this category. To learn more on property mapping to categories, visit [Property Categorization](../Content/PropertyCategorization.md) page.

## Registering a custom renderer

In order to tell the [VirtualizedPropertyGrid]($components-react) which React component `my_custom_renderer` refers to, we will need to register a component factory under this custom renderer name:

```tsx
[[include:Presentation.Customization.BasicCategoryRenderer]]
```

Once the code above is run, [VirtualizedPropertyGrid]($components-react) will render contents of `my_custom_category` using our new custom component, which currently displays primitive properties encountered in this category.

## Connecting properties to instances

Sometimes we need to know which instance(s) a specific [PropertyRecord]($appui-abstract) refers to. If we know that [PresentationPropertyDataProvider]($presentation-components) is being used to load properties into the grid, then the instance keys could be retrieved the following way:

```ts
[[include:Presentation.Customization.PropertyRecordToInstanceKey]]
```
