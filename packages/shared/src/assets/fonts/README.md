# Bundled web fonts

Self-hosted `woff2` web fonts referenced by the shared design tokens
(`tokens.$font-family-base`, `tokens.$font-family-condensed`) and loaded via the
`@font-face` block in `../../styles/global.scss`.

Both families are licensed under the **SIL Open Font License, Version 1.1**,
which permits bundling, embedding, and redistribution (including in commercial
products). The full license text for each — including its copyright notice — is
in the accompanying `LICENSE-*.txt` files, retained per the OFL's attribution
requirement.

The `woff2` files are the Latin-subset builds served by Google Fonts; the fonts
and their licenses are unchanged by subsetting. If a sim ever needs extended or
non-Latin glyphs, add the corresponding subsets.

## Lato

- **Files:** `lato-400.woff2`, `lato-400-italic.woff2`, `lato-700.woff2`
- **Designer:** Łukasz Dziedzic (tyPoland)
- **License:** SIL Open Font License 1.1 — see [`LICENSE-Lato.txt`](./LICENSE-Lato.txt)
- **Copyright:** Copyright (c) 2010-2014 by tyPoland Lukasz Dziedzic (team@latofonts.com) with Reserved Font Name "Lato"
- **Source:** <https://fonts.google.com/specimen/Lato> · <https://github.com/google/fonts/tree/main/ofl/lato>

## Roboto Condensed

- **Files:** `roboto-condensed.woff2` (variable weight, 100–900)
- **Authors:** The Roboto Project Authors
- **License:** SIL Open Font License 1.1 — see [`LICENSE-RobotoCondensed.txt`](./LICENSE-RobotoCondensed.txt)
- **Copyright:** Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic)
- **Source:** <https://fonts.google.com/specimen/Roboto+Condensed> · <https://github.com/google/fonts/tree/main/ofl/robotocondensed>

> Note: Roboto Condensed was relicensed from Apache 2.0 to the SIL Open Font
> License; the OFL is the current license (verified against the `google/fonts`
> repository).
