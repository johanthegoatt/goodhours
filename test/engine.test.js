const test = require("node:test");
const assert = require("node:assert");
const G = require("../src/engine.js");

const ny = { name: "Ana", city: "New York", zone: "America/New_York", start: 540, end: 1020, days: [1, 2, 3, 4, 5] };
const ldn = { name: "Ben", city: "London", zone: "Europe/London", start: 540, end: 1020, days: [1, 2, 3, 4, 5] };
const mnl = { name: "Cy", city: "Manila", zone: "Asia/Manila", start: 540, end: 1020, days: [1, 2, 3, 4, 5] };
const syd = { name: "Di", city: "Sydney", zone: "Australia/Sydney", start: 540, end: 1020, days: [1, 2, 3, 4, 5] };

test("offsets follow each country's own clock change date", () => {
  // Between 25 Oct and 1 Nov 2026 Europe has changed back and the US has not.
  const before = Date.UTC(2026, 9, 20, 12);
  const gap = Date.UTC(2026, 9, 28, 12);
  const after = Date.UTC(2026, 10, 4, 12);
  const diff = (ms) => G.offset("Europe/London", ms) - G.offset("America/New_York", ms);
  assert.strictEqual(diff(before), 300);
  assert.strictEqual(diff(gap), 240);
  assert.strictEqual(diff(after), 300);
});

test("instant round-trips wall clock times, including half-hour zones", () => {
  for (const zone of ["Asia/Kolkata", "Australia/Adelaide", "America/St_Johns", "Asia/Kathmandu"]) {
    const ms = G.instant(zone, 2026, 3, 15, 9, 30);
    const l = G.local(zone, ms);
    assert.deepStrictEqual([l.y, l.m, l.d, l.h, l.min], [2026, 3, 15, 9, 30], zone);
  }
});

test("a time in the skipped spring-forward hour lands after the gap", () => {
  // US clocks jump 2:00 -> 3:00 on 8 March 2026.
  const ms = G.instant("America/New_York", 2026, 3, 8, 2, 30);
  const l = G.local("America/New_York", ms);
  assert.strictEqual(l.h, 3);
});

test("parseHours reads the ways people write a working day", () => {
  assert.deepStrictEqual(G.parseHours("9-5"), [540, 1020]);
  assert.deepStrictEqual(G.parseHours("9am - 5:30pm"), [540, 1050]);
  assert.deepStrictEqual(G.parseHours("08:00-16:00"), [480, 960]);
  assert.deepStrictEqual(G.parseHours("8.30 to 4"), [510, 960]);
  assert.deepStrictEqual(G.parseHours("10pm-6am"), [1320, 1800]);
  assert.strictEqual(G.parseHours("nine to five"), null);
  assert.strictEqual(G.parseHours("13pm-2pm"), null);
});

test("New York and London: the best time is in both working days", () => {
  const slots = G.day({ people: [ny, ldn], host: ny.zone, date: "2026-10-20", length: 30 });
  const top = G.best(slots, 3);
  assert.deepStrictEqual(top[0].feels, ["work", "work"]);
  const l = G.local(ny.zone, top[0].ms);
  // 9:00 in New York is 14:00 in London, both inside 9-5.
  assert.strictEqual(l.h * 60 + l.min, 540);
});

test("a meeting must fit whole: 4:45pm for 30 minutes runs past 5pm", () => {
  const ms = G.instant(ny.zone, 2026, 10, 20, 16, 45);
  assert.strictEqual(G.feel(ny, ms, 30), "edge");
  assert.strictEqual(G.feel(ny, ms, 15), "work");
});

test("weekends count as the person's own time", () => {
  const sat = G.instant(ny.zone, 2026, 10, 24, 11, 0);
  assert.strictEqual(G.feel(ny, sat, 30), "off");
  // Someone whose week is Sunday to Thursday works on Sunday.
  const tlv = { zone: "Asia/Jerusalem", start: 540, end: 1020, days: [0, 1, 2, 3, 4] };
  const sun = G.instant(tlv.zone, 2026, 10, 25, 11, 0);
  assert.strictEqual(G.feel(tlv, sun, 30), "work");
});

test("night shifts that run past midnight count as work", () => {
  const nurse = { zone: "Europe/London", start: 1320, end: 1800, days: [1, 2, 3, 4, 5] };
  // 2am on Tuesday is still Monday night's shift.
  const ms = G.instant(nurse.zone, 2026, 10, 20, 2, 0);
  assert.strictEqual(G.feel(nurse, ms, 30), "work");
});

test("when days don't overlap, alternating two times is fairer than one", () => {
  const la = { ...ny, zone: "America/Los_Angeles" };
  const ber = { ...ldn, zone: "Europe/Berlin" };
  const people = [la, mnl, ber];
  const slots = G.day({ people, host: la.zone, date: "2026-10-20", length: 60 });
  const rot = G.rotation(slots, people);
  assert.ok(rot, "expected a rotation");
  const single = G.best(slots, 1)[0];
  const singleWorst = Math.max(...single.feels.map((f) => G.COST[f])) * 2;
  assert.ok(rot.worst < singleWorst);
  // Nobody gets the night slot both weeks.
  for (let k = 0; k < people.length; k++) {
    assert.ok(!(rot.a.feels[k] === "night" && rot.b.feels[k] === "night"));
  }
});

test("no rotation is offered when one time already suits everyone", () => {
  const slots = G.day({ people: [ny, ldn], host: ny.zone, date: "2026-10-20", length: 30 });
  assert.strictEqual(G.rotation(slots, [ny, ldn]), null);
});

test("clockChanges finds the 2026 autumn changes to the minute", () => {
  const from = Date.UTC(2026, 9, 15);
  const ch = G.clockChanges(["America/New_York", "Europe/London", "Asia/Manila", "Australia/Sydney"], from, 30);
  const byZone = Object.fromEntries(ch.map((c) => [c.zone, c]));
  assert.strictEqual(byZone["Europe/London"].at, Date.UTC(2026, 9, 25, 1, 0));
  assert.strictEqual(byZone["America/New_York"].at, Date.UTC(2026, 10, 1, 6, 0));
  assert.strictEqual(byZone["Asia/Manila"], undefined);
  assert.strictEqual(ch[0].zone, "Europe/London");
});

test("weeklyDrift shows the week a fixed New York meeting moves in London", () => {
  const ms = G.instant(ny.zone, 2026, 10, 20, 10, 0);
  const drift = G.weeklyDrift(ms, ny.zone, [ny, ldn, syd], 4);
  const ben = drift.moves.filter((m) => m.person === 1);
  // 3pm in London, then 2pm for one week, then 3pm again.
  assert.deepStrictEqual(ben.map((m) => [m.from, m.to]), [[900, 840], [840, 900]]);
  assert.ok(drift.moves.every((m) => m.person !== 0));
});

test("invite text lists each person in their own time", () => {
  const ms = G.instant(ny.zone, 2026, 10, 20, 9, 0);
  const text = G.inviteText({ people: [ny, mnl], ms, length: 30, title: "Catch-up", weekly: true, hostCity: "New York" });
  assert.match(text, /Ana \(New York\): Tue 20 Oct, 9am to 9:30am/);
  assert.match(text, /Cy \(Manila\): Tue 20 Oct, 9pm to 9:30pm/);
  assert.match(text, /Every week/);
});

test("share links survive a round trip and drop bad zones", () => {
  const state = { people: [ny, { ...ldn, name: "Bé & co" }], date: "2026-10-20", length: 45, weekly: true };
  const back = G.decode("#" + G.encode(state));
  assert.strictEqual(back.people[1].name, "Bé & co");
  assert.deepStrictEqual(back.people[0].days, [1, 2, 3, 4, 5]);
  assert.strictEqual(back.length, 45);
  assert.strictEqual(back.weekly, true);
  assert.strictEqual(G.decode("#p=x~y~Not/AZone~540~1020~12345"), null);
});

test("clock formats in 12 and 24 hour styles", () => {
  assert.strictEqual(G.clock(0), "12am");
  assert.strictEqual(G.clock(750), "12:30pm");
  assert.strictEqual(G.clock(1500), "1am");
  assert.strictEqual(G.clock(1050, "24"), "17:30");
});
