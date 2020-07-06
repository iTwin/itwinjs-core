## Developing a desktop viewer

### Setup
- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- [Clone imodeljs-samples repo](https://github.com/imodeljs/imodeljs-samples)

### Build
- Open the cloned repo in VS Code
- `cd interactive-app`
- `cd simple-viewer-app`
- Edit interactive-app\simple-viewer-app\.env.local
    > `imjs_test_imodel` = The name of your iModel<br/>

- `npm install`
- `npm run build`

### Run
- `npm run electron`

