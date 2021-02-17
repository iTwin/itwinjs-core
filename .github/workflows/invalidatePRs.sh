#!/bin/bash

# GitHub workflow handles invalidating Pull Requests after 3 hours.
#
# It will only invalidate open non-draft pull requests and mark each statuses
#

# Get all active PRs
# https://docs.github.com/en/rest/reference/pulls#list-pull-requests
prs=$(curl \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/imodeljs/itwin-viewer/pulls)

# test=$(echo $prs | jq '.[]')

# echo $test

# jq '.[] | .version'

for pr in $(echo ${prs} | jq '.[]'); do
    # _jq() {
    #  echo ${row} | base64 --decode | jq -r ${1}
    # }

    echo $pr

    break

   # echo $(_jq '.name')
done

# If ['state'] === 'open' and ['draft'] === false

## TODO Need to use to test for how long ago it expired
# ['updated_at']

# Get all statuses of the PR
#   e.g. https://api.github.com/repos/imodeljs/imodeljs/statuses/c29a168b6a201052098ea6743041868bfbadaa4f
# ['statuses_url']

# loop over the statuses
# Invalidate if ['state'] === 'success' && ['context'] !== 'license/cla'
# ['status']

# Re-create the state of status
#   {
#     "state":
#     "target_url":
#     "description": "The build has timed out"
#     "context":
#   }

# Get the sha of the pr ['head']['sha']
# curl \
#   -X POST \
#   -H "Accept: application/vnd.github.v3+json" \
#   https://api.github.com/repos/imodeljs/imodeljs/statuses/SHA \
#   -d '{"state":"state"}'
