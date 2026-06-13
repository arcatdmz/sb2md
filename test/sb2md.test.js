const assert = require("node:assert/strict");
const test = require("node:test");
const { sb2md } = require("../dist");

test("indent", () => {
  assert.equal(sb2md(" a"), "  - a");
});

test("bold, strike, underline, italic and nested links", () => {
  assert.equal(sb2md("[* 強調]"), "**強調**");
  assert.equal(sb2md("[- [日本語]]"), "~~[日本語](./%E6%97%A5%E6%9C%AC%E8%AA%9E.md)~~");
  assert.equal(sb2md("[_ under] [/ italic]"), "<u>under</u> *italic*");
});

test("links", () => {
  assert.equal(sb2md("[日本語]"), "[日本語](./%E6%97%A5%E6%9C%AC%E8%AA%9E.md)");
  assert.equal(sb2md("[0]"), "[0](./0.md)");
  assert.equal(
    sb2md("[/textalive/TextAlive Fonts]"),
    "[/textalive/TextAlive Fonts](https://scrapbox.io/textalive/TextAlive%20Fonts)"
  );
  assert.equal(
    sb2md("[https://example.com Example] [Example https://example.com]"),
    "[Example](https://example.com) [Example](https://example.com)"
  );
});

test("internal link base option", () => {
  assert.equal(
    sb2md("[AIST]", { internalLinkBase: "https://scrapbox.io/arcatdmz" }),
    "[AIST](https://scrapbox.io/arcatdmz/AIST)"
  );
});

test("hashtag does not consume URL fragments", () => {
  assert.equal(sb2md("#日本語"), "[#日本語](./%E6%97%A5%E6%9C%AC%E8%AA%9E.md)");
  assert.equal(sb2md("https://example.com/a#b #tag"), "https://example.com/a#b [#tag](./tag.md)");
});

test("inline code prevents Cosense parsing", () => {
  assert.equal(sb2md("`alert('[World]')` [World]"), "`alert('[World]')` [World](./World.md)");
});

test("gyazo and direct images", () => {
  assert.equal(
    sb2md("[https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2]"),
    "[![https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2/thumb/250](https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2/thumb/250)](https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2)"
  );
  assert.equal(
    sb2md("[https://example.com/a.png]"),
    "![https://example.com/a.png](https://example.com/a.png)"
  );
});

test("image mixed with text is split into block-like lines", () => {
  assert.equal(
    sb2md("before [https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2] after [https://example.com/out]"),
    "before\n\n[![https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2/thumb/250](https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2/thumb/250)](https://gyazo.com/b50a9bd54b16d3b1924043648ddca7d2)\n\nafter [https://example.com/out](https://example.com/out)"
  );
});

test("image-only lines are separated from adjacent paragraphs", () => {
  assert.equal(
    sb2md("before\n[https://example.com/a.png]\nafter"),
    "before\n\n![https://example.com/a.png](https://example.com/a.png)\n\nafter"
  );
});

test("separate image-only lines become separate image blocks", () => {
  assert.equal(
    sb2md("[https://example.com/a.png]\n[https://example.com/b.png]"),
    "![https://example.com/a.png](https://example.com/a.png)\n\n![https://example.com/b.png](https://example.com/b.png)"
  );
});

test("multiple images on one Cosense line stay together", () => {
  assert.equal(
    sb2md("[https://example.com/a.png] [https://example.com/b.png]"),
    "![https://example.com/a.png](https://example.com/a.png)![https://example.com/b.png](https://example.com/b.png)"
  );
});

test("code block strips Cosense code indentation", () => {
  assert.equal(
    sb2md("code:hello.js\n function () {\n  console.log('hello')\n }"),
    "```js\nfunction () {\n console.log('hello')\n}\n```"
  );
});

test("table block", () => {
  assert.equal(
    sb2md("table:comparison\n Name\tValue\n A\t[Link]\n"),
    "| Name | Value |\n| --- | --- |\n| A | [Link](./Link.md) |"
  );
});

test("block quote", () => {
  assert.equal(sb2md("> hello [World]\n>"), "> hello [World](./World.md)<br>\n> &nbsp;<br>");
  assert.equal(sb2md("  >"), "    - > &nbsp;<br>");
  assert.equal(sb2md("> title\n> ============================"), "> title<br>\n> ============================<br>");
});
