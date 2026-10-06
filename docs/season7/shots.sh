# Phone-size intro + gameplay captures for Season 7 levels: bash docs/season7/shots.sh 106 110 ...
cd "$(dirname "$0")/../.."
for id in "$@"; do
  node tools/shot_cli.mjs --url http://localhost:5264/ --out docs/season7/shots/L$id.png --wait 3 --timeout 240 \
    --js "(async () => { for (let i = 0; i < 160 && !window.__game; i++) await new Promise((r) => setTimeout(r, 500)); window.__game.startLevel(window.__game.LEVELS.findIndex((l) => l.id === $id)); return 'started'; })()" --then 6 \
    --js "[...document.querySelectorAll('button')].find((b) => /Let.s go/i.test(b.textContent))?.click(); 'go'" --then 5 2>&1 | grep -v "^saved"
done
