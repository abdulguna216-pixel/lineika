#!/bin/zsh
cd -- "${0:A:h}"
lineyka_node=$(command -v node)
if [[ -z "$lineyka_node" ]]; then
  lineyka_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$lineyka_node" ]]; then
  print "Для запуска установите Node.js 18 или новее."
  read -k 1
  exit 1
fi
print "ЛИНЕЙКА — http://127.0.0.1:4173"
(sleep 1; open 'http://127.0.0.1:4173') &
"$lineyka_node" server.mjs
