# Season 6 notes (TIGHT SQUEEZE)

## Engine issue found: instance tint colors every part
`src/engine/render.js:32` (`patchProps`) replaces `'vColor.xyz *= instanceColor.xyz;'` inside
`onBeforeCompile`, but at that point the vertex shader still holds `#include <color_vertex>`
(three r169 expands includes later), so the replace never matches. Result: the per-instance
tint multiplies EVERY part of a prop, not just its TINT parts (gallery2.js already mentions it
under `?bug=1`). Repro: any prop with a baked detail on a tinted body, e.g. Season 6 `giftbox`
tint 0 shows its gold ribbon as dark red; a green wreath with a red-tinted bow renders near black.

Likely fix (not applied, engine is read-only for lanes): replace the
`#include <color_vertex>` chunk instead, as gallery2.js `patchTint` does.

Season 6 workaround (content only): props whose color lives in baked details (wreath, hay roll,
hay wagon, pumpkin cart, scarecrow pal, wash bucket, bath stool, spa bench, gift sleigh, holiday
tree, prize pumpkin, toy sled, gift stack, apple basket) use near-white `NEUTRAL` tints, so they
look as authored. Candy-cane stripes use a darker shade of the tint instead of white.

## Dev pages
- `docs/season6/gallery.html?ids=...` (`&norm=1`, `&tints=1`): the Season 6 props.
- `docs/season6/backdrop.html?world=spa|pumpkin|holiday&w=26&d=34`: the scenery.

## Review frames (`shots/`)
Prop galleries per world, level intros (91, 92, 96, 98, 100, 104, 105) and gameplay after
"Let's go" (94, 97, 103, 105), all at 390x844 phone size.
