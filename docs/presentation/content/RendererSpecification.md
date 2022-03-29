# Renderer specification

> TypeScript type: [CustomRendererSpecification]($presentation-common).

This specification allows defining a custom renderer, which can be used to render properties or categories.

## Attributes

| Name                                      | Required? | Type     | Default |
| ----------------------------------------- | --------- | -------- | ------- |
| [`rendererName`](#attribute-renderername) | Yes       | `string` |         |

### Attribute: `rendererName`

Name of the renderer that's going to be used in UI components. Value of this attribute corresponds
to [RendererDescription.name]($presentation-common) attribute that gets assigned to whatever the renderer
is set on.

|                 |          |
| --------------- | -------- |
| **Type**        | `string` |
| **Is Required** | Yes      |

```ts
[[include:Presentation.Content.Customization.PropertySpecification.Renderer.Ruleset]]
```

```ts
[[include:Presentation.Content.Customization.PropertySpecification.Renderer.Result]]
```
