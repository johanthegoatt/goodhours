// GoodHours engine: find a meeting time that lands inside everyone's day.
// All time zone maths goes through Intl.DateTimeFormat and the IANA zone
// names, never fixed UTC offsets, so clock changes (which happen on
// different dates in different countries) are handled per day.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoodHours = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MIN = 60000;
  var fmtCache = {};

  function formatter(zone) {
    if (!fmtCache[zone]) {
      fmtCache[zone] = new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", weekday: "short"
      });
    }
    return fmtCache[zone];
  }

  function isZone(zone) {
    try { formatter(zone); return true; } catch (e) { return false; }
  }

  var WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  // Wall clock in `zone` at instant `ms`.
  function local(zone, ms) {
    var p = {};
    formatter(zone).formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return {
      y: +p.year, m: +p.month, d: +p.day,
      h: +p.hour % 24, min: +p.minute,
      wd: WD[p.weekday]
    };
  }

  // Minutes east of UTC in `zone` at instant `ms`.
  function offset(zone, ms) {
    var l = local(zone, ms);
    var asUtc = Date.UTC(l.y, l.m - 1, l.d, l.h, l.min);
    return Math.round((asUtc - Math.floor(ms / MIN) * MIN) / MIN);
  }

  // Instant for a wall clock time in `zone`. In the hour skipped by a
  // spring-forward this lands just after the gap, like most calendars.
  function instant(zone, y, m, d, h, min) {
    var guess = Date.UTC(y, m - 1, d, h, min || 0);
    var want = Date.UTC(y, m - 1, d, h, min || 0);
    // The two offsets in force around that day; one of them fits.
    var a = guess - offset(zone, guess - 1440 * MIN) * MIN;
    var b = guess - offset(zone, guess + 1440 * MIN) * MIN;
    var fits = [a, b].filter(function (t) {
      var l = local(zone, t);
      return Date.UTC(l.y, l.m - 1, l.d, l.h, l.min) === want;
    });
    if (fits.length) return Math.min.apply(null, fits);
    return Math.max(a, b);
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(l) { return l.y + "-" + pad(l.m) + "-" + pad(l.d); }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }

  // "9-5", "9am-5:30pm", "09:00-17:00", "8.30 to 4" -> [startMin, endMin]
  function parseHours(text) {
    var s = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
    var parts = s.split(/\s*(?:-|–|to|until)\s*/);
    if (parts.length !== 2) return null;
    var a = parseClock(parts[0]), b = parseClock(parts[1]);
    if (!a || !b) return null;
    var start = a.min, end = b.min;
    // "9-5": no am/pm on the end and it is earlier than the start, so it's pm.
    if (!b.ap && end <= start && end + 720 > start) end += 720;
    if (end <= start) end += 1440;
    if (end - start > 1440 || end - start < 15) return null;
    return [start, end];
  }

  function parseClock(t) {
    var m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a|p)?$/.exec(t.trim());
    if (!m) return null;
    var h = +m[1], mi = m[2] ? +m[2] : 0, ap = m[3] ? m[3][0] : "";
    if (h > 24 || mi > 59) return null;
    if (ap) {
      if (h < 1 || h > 12) return null;
      if (h === 12) h = 0;
      if (ap === "p") h += 12;
    }
    return { min: h * 60 + mi, ap: !!ap };
  }

  function clock(min, style) {
    min = ((min % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    if (style === "24") return pad(h) + ":" + pad(m);
    var ap = h < 12 ? "am" : "pm";
    var h12 = h % 12 || 12;
    return h12 + (m ? ":" + pad(m) : "") + ap;
  }

  // How a moment feels for one person.
  //   work  - inside their working hours on a working day
  //   edge  - within an hour either side of them (early start, late finish)
  //   off   - awake but their own time (evening, weekend)
  //   night - between 10pm and 7am where they are
  var COST = { work: 0, edge: 1, off: 4, night: 12 };

  function feel(person, ms, length) {
    var worst = "work";
    var rank = { work: 0, edge: 1, off: 2, night: 3 };
    // Check the start, the middle and the last minute of the meeting.
    var probes = [0, Math.floor(length / 2), Math.max(0, length - 1)];
    for (var i = 0; i < probes.length; i++) {
      var f = feelAt(person, ms + probes[i] * MIN);
      if (rank[f] > rank[worst]) worst = f;
    }
    return worst;
  }

  function feelAt(person, ms) {
    var l = local(person.zone, ms);
    var t = l.h * 60 + l.min;
    var days = person.days || [1, 2, 3, 4, 5];
    var s = person.start, e = person.end;
    // A shift that runs past midnight belongs to the day it started.
    var inShift = function (wd, mins) {
      return days.indexOf(wd) >= 0 && mins >= s && mins < e;
    };
    if (inShift(l.wd, t) || (e > 1440 && inShift((l.wd + 6) % 7, t + 1440))) return "work";
    var nearDay = days.indexOf(l.wd) >= 0;
    if (nearDay && ((t >= s - 60 && t < s) || (t >= e && t < e + 60))) return "edge";
    if (t >= 22 * 60 || t < 7 * 60) return "night";
    return "off";
  }

  // Every start time on the organiser's chosen day, scored.
  function day(opts) {
    var people = opts.people, host = opts.host || people[0].zone;
    var dt = parseDate(opts.date);
    var step = opts.step || 30, length = opts.length || 30;
    var startMs = instant(host, dt.y, dt.m, dt.d, 0, 0);
    var endMs = instant(host, dt.y, dt.m, dt.d + 1, 0, 0);
    var out = [];
    for (var ms = startMs; ms < endMs; ms += step * MIN) {
      var feels = people.map(function (p) { return feel(p, ms, length); });
      var cost = 0, worst = 0;
      feels.forEach(function (f) { cost += COST[f]; worst = Math.max(worst, COST[f]); });
      out.push({ ms: ms, feels: feels, cost: cost, worst: worst });
    }
    return out;
  }

  // Lowest cost first; on a tie prefer the slot where the unhappiest
  // person is least unhappy, then earlier in the host's day.
  function best(slots, n) {
    var sorted = slots.slice().sort(function (a, b) {
      return a.worst - b.worst || a.cost - b.cost || a.ms - b.ms;
    });
    var picked = [];
    for (var i = 0; i < sorted.length && picked.length < (n || 3); i++) {
      var s = sorted[i];
      // Skip a time next to one already picked: 9:00 and 9:30 aren't two ideas.
      var close = picked.some(function (p) { return Math.abs(p.ms - s.ms) < 90 * MIN && p.cost === s.cost; });
      if (!close) picked.push(s);
    }
    return picked;
  }

  // When nobody's day overlaps, share the bad hours: pick two times to
  // alternate week by week so the person hit hardest by one is spared by
  // the other. Minimises the worst person's total over the pair.
  function rotation(slots, people) {
    var pool = slots.filter(function (s) { return s.worst < COST.night || slots.every(function (x) { return x.worst >= COST.night; }); });
    var bestPair = null;
    for (var i = 0; i < pool.length; i++) {
      for (var j = i + 1; j < pool.length; j++) {
        var a = pool[i], b = pool[j], worst = 0, total = 0;
        for (var k = 0; k < people.length; k++) {
          var c = COST[a.feels[k]] + COST[b.feels[k]];
          worst = Math.max(worst, c);
          total += c;
        }
        if (!bestPair || worst < bestPair.worst || (worst === bestPair.worst && total < bestPair.total)) {
          bestPair = { a: a, b: b, worst: worst, total: total };
        }
      }
    }
    var single = best(slots, 1)[0];
    var singleWorst = 0;
    single.feels.forEach(function (f) { singleWorst = Math.max(singleWorst, COST[f] * 2); });
    // Only worth suggesting if alternating is fairer than one fixed time.
    if (!bestPair || bestPair.worst >= singleWorst) return null;
    return bestPair;
  }

  // Clock changes for each zone within `days` after `fromMs`.
  function clockChanges(zones, fromMs, days) {
    var out = [];
    var seen = {};
    zones.forEach(function (zone) {
      if (seen[zone]) return;
      seen[zone] = true;
      var prev = offset(zone, fromMs);
      for (var d = 1; d <= days; d++) {
        var t = fromMs + d * 1440 * MIN;
        var o = offset(zone, t);
        if (o !== prev) {
          // Narrow to the minute it happens.
          var lo = t - 1440 * MIN, hi = t;
          while (hi - lo > MIN) {
            var mid = lo + Math.floor((hi - lo) / 2 / MIN) * MIN;
            if (offset(zone, mid) === prev) lo = mid; else hi = mid;
          }
          out.push({ zone: zone, at: hi, from: prev, to: o });
          prev = o;
        }
      }
    });
    return out.sort(function (a, b) { return a.at - b.at; });
  }

  // A weekly meeting set in the host's zone: where does it land for each
  // person each week? Lists the weeks where someone's local time moves.
  function weeklyDrift(ms, host, people, weeks) {
    var l = local(host, ms);
    var rows = [];
    for (var w = 0; w < weeks; w++) {
      var t = instant(host, l.y, l.m, l.d + 7 * w, l.h, l.min);
      rows.push({
        ms: t,
        times: people.map(function (p) { var x = local(p.zone, t); return x.h * 60 + x.min; })
      });
    }
    var moves = [];
    for (var i = 1; i < rows.length; i++) {
      people.forEach(function (p, k) {
        var a = rows[i - 1].times[k], b = rows[i].times[k];
        if (a !== b) moves.push({ week: i, ms: rows[i].ms, person: k, from: a, to: b });
      });
    }
    return { rows: rows, moves: moves };
  }

  function offsetLabel(min) {
    var sign = min < 0 ? "-" : "+";
    var a = Math.abs(min);
    return "UTC" + sign + Math.floor(a / 60) + (a % 60 ? ":" + pad(a % 60) : "");
  }

  var DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function dayLabel(zone, ms) {
    var l = local(zone, ms);
    return DAY_NAMES[l.wd] + " " + l.d + " " + MONTHS[l.m - 1];
  }

  // Text to paste into an invite: one line per person in their own time.
  function inviteText(opts) {
    var lines = [opts.title || "Meeting"];
    opts.people.forEach(function (p) {
      var l = local(p.zone, opts.ms);
      var e = local(p.zone, opts.ms + opts.length * MIN);
      lines.push("- " + (p.name || p.city) + " (" + p.city + "): " + dayLabel(p.zone, opts.ms) + ", " +
        clock(l.h * 60 + l.min, opts.style) + " to " + clock(e.h * 60 + e.min, opts.style));
    });
    if (opts.weekly) lines.push("Every week, set in " + opts.hostCity + " time.");
    return lines.join("\n");
  }

  // ----- Calendar file -----
  // One-off meetings are written in UTC. Weekly ones are written in the
  // host's zone with a VTIMEZONE built from the real clock changes over the
  // next two years, so the series follows the host's clock the way
  // GoodHours plans it (RFC 5545 sections 3.6.5 and 3.8.5.3).

  function icsStamp(y, m, d, h, min) {
    return "" + y + pad(m) + pad(d) + "T" + pad(h) + pad(min) + "00";
  }
  function utcStamp(ms) {
    var t = new Date(ms);
    return icsStamp(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes()) + "Z";
  }
  function localStamp(zone, ms) {
    var l = local(zone, ms);
    return icsStamp(l.y, l.m, l.d, l.h, l.min);
  }
  function icsOffset(min) {
    var sign = min < 0 ? "-" : "+";
    var a = Math.abs(min);
    return sign + pad(Math.floor(a / 60)) + pad(a % 60);
  }
  function icsEscape(text) {
    return String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }
  // RFC 5545 3.1: fold lines longer than 75 octets.
  function fold(line) {
    var out = "", bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var size = unescape(encodeURIComponent(line[i])).length;
      if (bytes + size > 75) { out += "\r\n "; bytes = 1; }
      out += line[i];
      bytes += size;
    }
    return out;
  }

  function vtimezone(zone, fromMs) {
    var lines = ["BEGIN:VTIMEZONE", "TZID:" + zone];
    var first = offset(zone, fromMs);
    lines.push("BEGIN:STANDARD", "DTSTART:19700101T000000", "TZOFFSETFROM:" + icsOffset(first),
      "TZOFFSETTO:" + icsOffset(first), "END:STANDARD");
    clockChanges([zone], fromMs, 731).forEach(function (c) {
      var kind = c.to > c.from ? "DAYLIGHT" : "STANDARD";
      // DTSTART is the wall time just before the change, in the old offset.
      var before = new Date(c.at + c.from * MIN);
      lines.push("BEGIN:" + kind,
        "DTSTART:" + icsStamp(before.getUTCFullYear(), before.getUTCMonth() + 1, before.getUTCDate(), before.getUTCHours(), before.getUTCMinutes()),
        "TZOFFSETFROM:" + icsOffset(c.from), "TZOFFSETTO:" + icsOffset(c.to), "END:" + kind);
    });
    lines.push("END:VTIMEZONE");
    return lines;
  }

  function toIcs(opts) {
    var end = opts.ms + opts.length * MIN;
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GoodHours//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    if (opts.weekly) lines = lines.concat(vtimezone(opts.hostZone, opts.ms));
    lines.push("BEGIN:VEVENT",
      "UID:" + (opts.uid || "goodhours-" + opts.ms) + "@goodhours",
      "DTSTAMP:" + utcStamp(opts.now || Date.now()));
    if (opts.weekly) {
      lines.push("DTSTART;TZID=" + opts.hostZone + ":" + localStamp(opts.hostZone, opts.ms),
        "DTEND;TZID=" + opts.hostZone + ":" + localStamp(opts.hostZone, end),
        "RRULE:FREQ=WEEKLY");
    } else {
      lines.push("DTSTART:" + utcStamp(opts.ms), "DTEND:" + utcStamp(end));
    }
    lines.push("SUMMARY:" + icsEscape(opts.title || "Meeting"));
    if (opts.description) lines.push("DESCRIPTION:" + icsEscape(opts.description));
    lines.push("END:VEVENT", "END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  // Share state in the URL fragment, which never reaches a server.
  function encode(state) {
    var p = state.people.map(function (x) {
      return [x.name || "", x.city, x.zone, x.start, x.end, (x.days || []).join("")].map(encodeURIComponent).join("~");
    }).join("|");
    return "p=" + p + "&d=" + state.date + "&l=" + state.length + (state.weekly ? "&w=1" : "");
  }

  function decode(hash) {
    var q = {};
    String(hash || "").replace(/^#/, "").split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1);
    });
    if (!q.p) return null;
    var people = q.p.split("|").map(function (row) {
      var f = row.split("~").map(decodeURIComponent);
      return {
        name: f[0], city: f[1], zone: f[2], start: +f[3], end: +f[4],
        days: (f[5] || "").split("").map(Number)
      };
    }).filter(function (p) { return isZone(p.zone) && p.end > p.start; });
    if (!people.length) return null;
    return { people: people, date: parseDate(q.d) ? q.d : null, length: +q.l || 30, weekly: q.w === "1" };
  }

  return {
    local: local, offset: offset, instant: instant, isZone: isZone,
    parseHours: parseHours, clock: clock, dateKey: dateKey, parseDate: parseDate,
    feel: feel, day: day, best: best, rotation: rotation, COST: COST,
    clockChanges: clockChanges, weeklyDrift: weeklyDrift,
    offsetLabel: offsetLabel, dayLabel: dayLabel, inviteText: inviteText, toIcs: toIcs,
    encode: encode, decode: decode, DAY_NAMES: DAY_NAMES
  };
});
