type=$1
curVer=$2
branch=$3

 # nightly = dev version
if [[ $type == "nightly"  ]] && [[ $curVer =~ ^-?[0-9]+\.[0-9]+\.[0-9]+-dev\.[0-9]+ ]]
then
  echo "version validation passed on bump $type"
  exit 0

# releaseCandidate = dev version && queued on master
elif [[ $type == "releaseCandidate" ]] && [[ $curVer =~ ^-?[0-9]+\.[0-9]+\.[0-9]+-dev\.[0-9]+ ]] && [[ $branch == "master" ]]
then
  echo "version validation passed on bump $type"
  exit 0

elif [[ $branch  =~ ^release\/[0-9]+\.[0-9]+.* ]]
then
  # minor = dev version && queued on release
  if [[ $type == "minor" ]] && [[ $curVer =~ ^-?[0-9]+\.[0-9]+\.[0-9]+-dev\.[0-9]+ ]]
  then
    echo "version validation passed on bump $type"
    exit 0

  # patch = non-dev version && queued on release sd
  elif [[ $type == "patch" ]] && [[ $curVer =~ ^-?[0-9]+\.[0-9]+\.[0-9]+$ ]]
  then
    echo "version validation passed on bump $type"
    exit 0
  fi
fi

echo "version validation failed"
exit 1