---
ignore: true
---
# NextVersion

Moved AzureFileHandler, IOSAzureFileHandler, UrlFileHandler and the iModelHub tests to the imodeljs-clients-backend package. This removes the dependency of imodeljs-clients on the "fs" module, and turns it into a browser only package.

To fix related build errors, update imports for these utilities from
```import {AzureFileHandler, IOSAzureFileHandler, UrlFileHandler} from "@bentley/imodels-clients";```
to
```import {AzureFileHandler, IOSAzureFileHandler, UrlFileHandler} from "@bentley/imodels-clients-backend";```


