#---------------------------------------------------------------------------------------------
# Copyright (c) Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#--------------------------------------------------------------------------------------------*/

# Docker container to run the RPC Interface tests against a given configuration.  See [sample .env](./template.env) for details.

### Stage 1: Base
FROM node:10.15.3

# adding every possible package for puppeteer
RUN apt update && apt install -y \
    apt-utils gconf-service libasound2 libatk1.0-0 libc6 \
    libcairo2 libcups2 libdbus-1-3 libexpat1 \
    libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \
    libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 \
    libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
    libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 \
    lsb-release xdg-utils wget

# Setup chrome linux sandbox (https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#setting-up-chrome-linux-sandbox)
# Cannot start container as root because chromium cannot start as root (https://crbug.com/638180)
# Puppetteer needs to launch in --no-sandbox mode for this version of the docker file to run
USER node

# Copy relevant folder and packages
RUN mkdir /home/node/rpctests
WORKDIR /home/node/rpctests

RUN npm install @itwin/rpcinterface-full-stack-tests@latest

# Export node modules path
RUN export PATH="$PATH:/home/node/rpctests/node_modules/.bin"

# ./node_modules/.bin/certa -r chrome -c ./node_modules/@bentley/$(TestPackageName)/certa.json

# Run tests on start up. Need to attach a ".env" as docker volume to /rpctests
# Run volume like this : "docker run --mount type=bind,source="$(pwd)"/.env,target=/home/node/rpctests/.env "
CMD [ "npx", "@itwin/certa", "-r", "chrome", "-c", "./node_modules/@itwin/rpcinterface-full-stack-tests/certa.json" ]
