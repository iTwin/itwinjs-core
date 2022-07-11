getVer="3.3.0-dev.4.5"
curVer=$(sed -e 's/^"//' -e 's/"$//' <<<"$getVer")
echo "$curVer <- current version"

if [[ $curVer =~ ^-?[0-9]+\.[0-9]+\.[0-9]+-dev\.[0-9]+ ]] && [[ a == b ]]
then
  echo "it is dev ver"
fi