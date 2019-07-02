#----------------------------------------------------------------------------------------------
# Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
# Licensed under the MIT License. See LICENSE.md in the project root for license terms.
#----------------------------------------------------------------------------------------------

FROM debian:9

RUN \
  apt-get update \
  && apt-get install -y curl \
  && curl -sL https://deb.nodesource.com/setup_10.x | bash - \
  && apt-get install -y git nodejs libnss3 libxss1 libatk-bridge2.0-0 libgtk-3-0 libasound2 locales zsh \
  && npm install -g @microsoft/rush \
  && localedef -i en_US -c -f UTF-8 -A /usr/share/locale/locale.alias en_US.UTF-8

ENV \
  LANG=en_US.utf8 \
  SHELL=/usr/bin/zsh

RUN \
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/robbyrussell/oh-my-zsh/master/tools/install.sh)" \
  && git clone --depth 1 https://github.com/junegunn/fzf.git ~/.fzf \
  && ~/.fzf/install --all \
  && mkdir -p /workspace/imodeljs

WORKDIR /workspace/imodeljs
CMD ["/usr/bin/zsh"]
