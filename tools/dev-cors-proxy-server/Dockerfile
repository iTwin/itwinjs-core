#
# We do this in two stages to avoid polluting the eventual
# container with a .npmrc that contains credentials.
#
# -------------------------------------------------------
# Stage 1: Create a build
# -------------------------------------------------------

# Specify a full version of node here
FROM node:8.9.1

RUN echo "Attempt number 12"

# Setup a shell
SHELL ["/bin/bash", "-c"]

# Setup verbosity of logs
# ENV NPM_CONFIG_LOGLEVEL verbose

# Set the working directory in the container for RUN and ADD commands
WORKDIR /app/

# Copy the .npmrc file from the project source directory to the container root directory
ADD .npmrc /root/

# Copy all local files into the image
COPY . /app/

# Install the dependencies - Add the explicit path to the npm server for the VPN
RUN echo -e "\n64.90.228.158    npm.bentley.com npm" >> /etc/hosts \
    && npm install \
	&& rm -f /root/.npmrc

# Tell Docker about the port we will run on
EXPOSE 3001

# Start the server
ENTRYPOINT ["node", "server.js"]

