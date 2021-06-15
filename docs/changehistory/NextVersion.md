---
publish: false
---
# NextVersion

## External Textures

API is now provided to wait for all pending external textures to finish loading. A method titled `waitForAllExternalTextures` has been added to [RenderSystem]($frontend). This method returns a promise which when resolved indicates that all pending external textures have finished loading from the backend.

Example:
```ts
await IModelApp.renderSystem.waitForAllExternalTextures(); // this will wait for all pending external textures to finish loading.
```
