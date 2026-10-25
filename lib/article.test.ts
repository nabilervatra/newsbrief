import assert from "node:assert/strict";
import test from "node:test";
import { extractText, parseArticle, toGNewsQuery } from "./article.ts";

test("toGNewsQuery quotes words with special characters only", () => {
  assert.equal(toGNewsQuery("  covid-19   vaccine "), '"covid-19" vaccine');
  assert.equal(toGNewsQuery("Apple's AI?"), `"Apple's" "AI?"`);
  assert.equal(toGNewsQuery('"interest rates" AND (Fed OR ECB) NOT Trump'), '"interest rates" AND (Fed OR ECB) NOT Trump');
  assert.equal(toGNewsQuery("Zürich élections 東京"), "Zürich élections 東京");
});

test("extractText keeps article paragraphs, drops scripts, nav crumbs and tags", () => {
  const html = `<script>var p = "<p>not this one, it is inside a script tag ok</p>";</script>
    <nav><p>Home</p></nav>
    <p class="lead">The council &amp; mayor approved the <a href="#">new budget</a> on Tuesday&#39;s vote.</p>
    <p>Spending on parks rises 12&#x25; while   road repairs\n get a separate fund.</p>`;
  assert.equal(
    extractText(html),
    "The council & mayor approved the new budget on Tuesday's vote.\n\nSpending on parks rises 12% while road repairs get a separate fund.",
  );
});

test("parseArticle validates the trust boundary", () => {
  assert.equal(parseArticle({ url: "javascript:alert(1)", title: "x" }), null);
  assert.equal(parseArticle({ url: "https://a.com/x" }), null);
  assert.equal(parseArticle(null), null);
  assert.deepEqual(parseArticle({ url: " https://a.com/x ", title: "T", publishedAt: "nope", imageUrl: "data:x", extra: 1 }), {
    url: "https://a.com/x",
    title: "T",
    description: null,
    content: null,
    source: null,
    imageUrl: null,
    publishedAt: null,
  });
});
