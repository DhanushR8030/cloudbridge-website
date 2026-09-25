Put real client logo files in this folder.

- Format: SVG preferred. PNG with a transparent background also works.
- Size: export at roughly 80-120px tall; width can vary, it will scale to fit automatically.
- Naming: use a simple lowercase name, e.g. acme.svg, brightpath.png

Then edit src/partials/client-logos.html and replace one placeholder chip, e.g.:

  <span class="logo-chip"><svg ...>...</svg><b>Vertane</b></span>

with:

  <span class="logo-chip"><img src="/logos/acme.svg" alt="Acme"></span>

Do this in BOTH marquee__group blocks in that file (they must stay identical -
the second one is the duplicate that makes the scroll loop seamless).

Once every placeholder is replaced with a real logo:
1. Remove data-sample="" from the <div class="clientwall" ...> line at the top
   of client-logos.html (this removes the yellow "Sample content" badge).
2. In src/site.config.js, set showSampleNotice: false.
