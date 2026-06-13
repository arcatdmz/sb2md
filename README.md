# sb2md

Convert Scrapbox/Cosense notation to Markdown.

```bash
sb2md README.sb > README.md
cat page.sb | sb2md
```

```js
const { convert } = require("sb2md");

const markdown = convert("[Cosense] #diary", {
  internalLinkBase: "https://scrapbox.io/example",
});
```

Supported notation includes:

- internal links, project links, external links, Gyazo/image links, and hashtags
- bracket styles such as `[* bold]`, `[- strike]`, `[_ underline]`, `[/ italic]`, and `[$ math]`
- inline code spans
- `code:filename.ext` blocks
- `table:name` blocks with tab-separated rows
- Cosense outline indentation and block quotes

The package is implemented in TypeScript and publishes CommonJS output for existing Node.js consumers.
