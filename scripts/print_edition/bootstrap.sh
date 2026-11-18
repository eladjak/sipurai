#!/usr/bin/env bash
set -euo pipefail
umask 077

root=$1
venv=$2
mkdir -p "$root"/{jobs,cache,chunks,incoming}
exec 9>"$root/bootstrap.lock"
flock -n 9 || exit 75

if [[ ! -f "$root/packages-ready" ]]; then
  rm -rf -- "$root/engine"
  mv -- "$4" "$root/engine"
  if [[ "$3" == install ]]; then
    export DEBIAN_FRONTEND=noninteractive
    . /etc/os-release
    [[ "$ID" == ubuntu && "${VERSION_CODENAME:-}" =~ ^[a-z]+$ ]]
    printf 'deb https://archive.ubuntu.com/ubuntu %s main universe\ndeb https://archive.ubuntu.com/ubuntu %s-updates main universe\ndeb https://security.ubuntu.com/ubuntu %s-security main universe\n' \
      "$VERSION_CODENAME" "$VERSION_CODENAME" "$VERSION_CODENAME" > "$root/ubuntu-proof.list"
    apt_opts=(-o Acquire::Retries=0 -o Acquire::https::Timeout=20
      -o "Dir::Etc::sourcelist=$root/ubuntu-proof.list" -o Dir::Etc::sourceparts=-)
    sudo apt-get "${apt_opts[@]}" update -qq
    sudo apt-get "${apt_opts[@]}" install -qy --no-install-recommends \
      poppler-utils fontconfig libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 libfribidi0 liblcms2-2
    python3 -m venv "$venv"
    "$venv/bin/pip" --disable-pip-version-check install --no-cache-dir --only-binary=:all: \
      --index-url https://pypi.org/simple --retries 0 --timeout 20 -r "$root/engine/requirements.txt"
  fi
  for command in pdftoppm pdfinfo pdftotext pdffonts pdfimages; do
    command -v "$command" >/dev/null
  done
  "$venv/bin/python" -B -c 'from PIL import features; import pikepdf, qrcode, weasyprint; assert features.check_feature("raqm") and features.check("webp")'
  touch "$root/packages-ready"
fi
