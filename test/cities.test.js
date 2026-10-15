const test = require("node:test");
const assert = require("node:assert");
const C = require("../src/cities.js");
const G = require("../src/engine.js");

test("every city points at a zone this runtime knows", () => {
  for (const [city, , zone] of C.LIST) assert.ok(G.isZone(zone), city + " " + zone);
});

test("search matches names, word starts, countries, old names and accents", () => {
  assert.strictEqual(C.search("man")[0].city, "Manchester");
  assert.strictEqual(C.search("manila")[0].zone, "Asia/Manila");
  assert.strictEqual(C.search("francisco")[0].city, "San Francisco");
  assert.ok(C.search("india").some((c) => c.city === "Mumbai"));
  assert.strictEqual(C.search("calcutta")[0].city, "Kolkata");
  assert.strictEqual(C.search("São Paulo")[0].city, "Sao Paulo");
  assert.strictEqual(C.search("Asia/Tokyo")[0].zone, "Asia/Tokyo");
  assert.deepStrictEqual(C.search("   "), []);
});

test("fromZone names the browser's own zone", () => {
  assert.strictEqual(C.fromZone("Asia/Manila").city, "Manila");
  assert.strictEqual(C.fromZone("America/Indiana/Knox").city, "Knox");
});
