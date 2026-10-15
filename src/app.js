// GoodHours page: people in, best times out. All scoring is in engine.js;
// this file keeps the form, the day strip and the notes in sync with it.
(function () {
  "use strict";
  var G = window.GoodHours, C = window.GoodHoursCities, Sol = window.Sol;
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "goodhours.v1";

  var state = { people: [], date: "", length: 30, weekly: false, style: "12" };
  var chosen = null;   // ms of the time being looked at
  var slots = [], top = [];
  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function myZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch (e) { return "UTC"; }
  }

  function blankPerson(zone) {
    var place = zone ? C.fromZone(zone) : null;
    return {
      name: "", city: place ? place.city : "", zone: place ? zone : "",
      start: 540, end: 1020, hours: "9-5", days: [1, 2, 3, 4, 5]
    };
  }

  function valid(p) { return p.zone && p.end > p.start && p.days.length; }
  function ready() { return state.people.filter(valid); }
  function label(p, i) { return p.name || p.city || "Person " + (i + 1); }
  function host() { return ready()[0]; }
  function fmt(min) { return G.clock(min, state.style); }
  function localMin(zone, ms) { var l = G.local(zone, ms); return l.h * 60 + l.min; }

  // ---------- people ----------
  var list = $("people"), tpl = $("person-tpl");

  function addPersonRow(p, focus) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    var uid = "p" + Math.random().toString(36).slice(2, 8);
    node.dataset.uid = uid;
    var name = node.querySelector('[data-k="name"]');
    var city = node.querySelector('[data-k="city"]');
    var hours = node.querySelector('[data-k="hours"]');
    var sug = node.querySelector(".suggest");
    sug.id = uid + "-list";
    city.setAttribute("aria-controls", sug.id);
    name.id = uid + "-name";
    node.querySelector('[data-l="name"]').setAttribute("for", name.id);
    name.value = p.name; city.value = p.city; hours.value = p.hours || hoursText(p);

    var days = node.querySelector(".days");
    DAY_ORDER.forEach(function (d) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "day"; b.textContent = G.DAY_NAMES[d];
      b.setAttribute("aria-pressed", p.days.indexOf(d) >= 0 ? "true" : "false");
      b.addEventListener("click", function () {
        var on = p.days.indexOf(d) >= 0;
        p.days = on ? p.days.filter(function (x) { return x !== d; }) : p.days.concat(d);
        b.setAttribute("aria-pressed", on ? "false" : "true");
        update();
      });
      days.appendChild(b);
    });

    name.addEventListener("input", function () { p.name = name.value.trim(); update(); });

    hours.addEventListener("input", function () {
      p.hours = hours.value;
      var h = G.parseHours(hours.value);
      if (h) { p.start = h[0]; p.end = h[1]; }
      else if (hours.value.trim()) { p.end = 0; }
      update();
    });
    hours.addEventListener("focus", function () { Sol.react("focus:hours"); });
    hours.addEventListener("blur", function () {
      if (G.parseHours(hours.value)) { hours.value = hoursText(p); p.hours = hours.value; }
    });

    // City box: a small combobox over the city list.
    var options = [], active = -1;
    function close() { sug.hidden = true; city.setAttribute("aria-expanded", "false"); city.removeAttribute("aria-activedescendant"); active = -1; }
    function choose(o) {
      p.city = o.city; p.zone = o.zone; city.value = o.city;
      close(); update();
      Sol.react("city");
    }
    function show() {
      options = C.search(city.value, 7);
      sug.innerHTML = "";
      options.forEach(function (o, i) {
        var li = document.createElement("li");
        li.id = uid + "-o" + i;
        li.setAttribute("role", "option");
        li.innerHTML = "<span></span><small></small>";
        li.firstChild.textContent = o.city;
        li.lastChild.textContent = o.country;
        li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(o); });
        sug.appendChild(li);
      });
      var open = options.length > 0 && document.activeElement === city;
      sug.hidden = !open;
      city.setAttribute("aria-expanded", open ? "true" : "false");
      mark(options.length ? 0 : -1);
    }
    function mark(i) {
      active = i;
      Array.prototype.forEach.call(sug.children, function (li, k) { li.setAttribute("aria-selected", k === i ? "true" : "false"); });
      if (i >= 0) city.setAttribute("aria-activedescendant", uid + "-o" + i); else city.removeAttribute("aria-activedescendant");
    }
    city.addEventListener("input", function () {
      p.city = city.value; p.zone = "";
      var exact = C.search(city.value, 2);
      if (exact.length && exact[0].city.toLowerCase() === city.value.trim().toLowerCase()) p.zone = exact[0].zone;
      show(); update();
    });
    city.addEventListener("focus", function () { if (city.value) show(); Sol.react("focus:city"); });
    city.addEventListener("blur", function () {
      setTimeout(close, 0);
      if (!p.zone && options.length && city.value.trim()) choose(options[0]);
    });
    city.addEventListener("keydown", function (e) {
      if (sug.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); mark(Math.min(options.length - 1, active + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(Math.max(0, active - 1)); }
      else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(options[active]); }
      else if (e.key === "Escape") { close(); }
    });

    node.querySelector(".remove").addEventListener("click", function () {
      var i = state.people.indexOf(p);
      state.people.splice(i, 1);
      node.remove();
      update();
      var next = list.querySelectorAll(".p-name")[Math.max(0, i - 1)];
      (next || $("add-person")).focus();
    });

    node._person = p;
    list.appendChild(node);
    if (focus) (p.zone ? name : city).focus();
  }

  function hoursText(p) {
    if (!(p.end > p.start)) return p.hours || "";
    return fmt(p.start) + " - " + fmt(p.end);
  }

  function refreshRows() {
    var now = Date.now();
    Array.prototype.forEach.call(list.children, function (node, i) {
      var p = node._person;
      var city = node.querySelector('[data-k="city"]');
      var hours = node.querySelector('[data-k="hours"]');
      var cityRead = city.parentNode.querySelector(".read");
      var hoursRead = hours.parentNode.querySelector(".read");
      var now$ = node.querySelector(".p-now"), dot = node.querySelector(".p-dot");
      node.querySelector(".remove").hidden = state.people.length < 2;
      node.querySelector(".p-name").placeholder = i === 0 ? "You" : "Name";

      if (p.zone) {
        var place = C.fromZone(p.zone);
        cityRead.textContent = (place.country && place.city === p.city ? place.country + ", " : "") + G.offsetLabel(G.offset(p.zone, now));
        city.removeAttribute("aria-invalid");
        var t = localMin(p.zone, now);
        now$.textContent = "now " + fmt(t) + ", " + G.DAY_NAMES[G.local(p.zone, now).wd];
        dot.classList.toggle("night", t >= 1320 || t < 420);
      } else {
        cityRead.textContent = p.city.trim() ? "Pick a city from the list" : "";
        if (p.city.trim() && document.activeElement !== city) city.setAttribute("aria-invalid", "true");
        now$.textContent = "";
      }

      var bad = hours.value.trim() && !G.parseHours(hours.value);
      if (bad) {
        hours.setAttribute("aria-invalid", "true");
        hoursRead.textContent = "Try 9-5 or 8:30am-4pm";
      } else {
        hours.removeAttribute("aria-invalid");
        var len = p.end - p.start;
        hoursRead.textContent = len > 0 ? Math.floor(len / 60) + (len % 60 ? "h " + (len % 60) + "m" : " hours") + (p.end > 1440 ? ", overnight" : "") : "";
      }
      if (!p.days.length) hoursRead.textContent = "Pick at least one working day";
    });
    var h = host();
    $("host-city").textContent = h ? h.city + "'s" : "your";
  }

  // ---------- results ----------
  function feelWord(f) {
    return { work: "work hours", edge: "early or late", off: "their own time", night: "asleep" }[f];
  }

  function verdict(s, people) {
    if (s.worst === 0) return { text: "Work hours for everyone", all: true };
    var groups = {};
    s.feels.forEach(function (f, i) { if (f !== "work") (groups[f] = groups[f] || []).push(label(people[i], state.people.indexOf(people[i]))); });
    var order = ["night", "off", "edge"], bits = [];
    order.forEach(function (f) {
      if (!groups[f]) return;
      var who = groups[f].join(" and ");
      bits.push(f === "night" ? who + " asleep" : f === "off" ? "outside " + who + "'s hours" : "a stretch for " + who);
    });
    var t = bits.join(", ");
    return { text: t.charAt(0).toUpperCase() + t.slice(1), all: false };
  }

  function whoList(ms, people) {
    var ul = document.createElement("ul");
    ul.className = "who";
    var hostDay = G.local(people[0].zone, ms).d;
    people.forEach(function (p) {
      var f = G.feel(p, ms, state.length);
      var li = document.createElement("li");
      var l = G.local(p.zone, ms);
      var day = l.d !== hostDay ? ' <span class="nextday">' + G.dayLabel(p.zone, ms) + "</span>" : "";
      li.innerHTML = "<b></b><span></span>" + day + ' <span class="tag ' + f + '">' + feelWord(f) + "</span>";
      li.firstChild.textContent = label(p, state.people.indexOf(p));
      li.childNodes[1].textContent = " " + fmt(l.h * 60 + l.min) + " in " + p.city;
      ul.appendChild(li);
    });
    return ul;
  }

  function renderPicks(people) {
    var box = $("picks");
    box.innerHTML = "";
    if (people.length < 2) {
      box.innerHTML = '<p class="empty">Add at least two people with a city and their hours.</p>';
      return;
    }
    top.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "pick";
      b.setAttribute("aria-pressed", s.ms === chosen ? "true" : "false");
      var v = verdict(s, people);
      var h = G.local(people[0].zone, s.ms);
      b.innerHTML = '<div class="pick-head"><span class="pick-time"></span><span class="verdict' + (v.all ? " all" : "") + '"></span></div>';
      b.querySelector(".pick-time").textContent = fmt(h.h * 60 + h.min) + " " + people[0].city + " time";
      b.querySelector(".verdict").textContent = v.text;
      b.appendChild(whoList(s.ms, people));
      b.addEventListener("click", function () { pick(s.ms); });
      box.appendChild(b);
    });
  }

  function renderStrip(people) {
    var wrap = $("strip-wrap"), strip = $("strip");
    wrap.hidden = people.length < 2;
    if (wrap.hidden) return;
    var grid = document.createElement("div");
    grid.className = "strip-grid";
    grid.style.gridTemplateColumns = "minmax(64px, 96px) repeat(" + slots.length + ", minmax(10px, 1fr))";
    var labels = document.createElement("div");
    labels.className = "col";
    labels.style.cursor = "default";
    labels.innerHTML = '<span class="hours">&nbsp;</span>';
    people.forEach(function (p, i) {
      var s = document.createElement("span");
      s.className = "strip-row-label";
      s.style.height = "22px";
      s.textContent = label(p, state.people.indexOf(p));
      labels.appendChild(s);
    });
    grid.appendChild(labels);
    slots.forEach(function (s, idx) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "col";
      b.dataset.ms = s.ms;
      var t = localMin(people[0].zone, s.ms);
      var hl = document.createElement("span");
      hl.className = "hours";
      hl.textContent = t % 180 === 0 ? fmt(t).replace(":00", "") : " ";
      b.appendChild(hl);
      s.feels.forEach(function (f) {
        var c = document.createElement("span");
        c.className = "cell " + f;
        b.appendChild(c);
      });
      var desc = people.map(function (p, i) { return label(p, state.people.indexOf(p)) + " " + feelWord(s.feels[i]); }).join(", ");
      b.setAttribute("aria-label", fmt(t) + ": " + desc);
      var on = s.ms === chosen;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      b.addEventListener("click", function () { pick(s.ms, true); });
      b.addEventListener("keydown", function (e) {
        var step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -idx : e.key === "End" ? slots.length - 1 - idx : 0;
        if (!step) return;
        e.preventDefault();
        var j = Math.max(0, Math.min(slots.length - 1, idx + step));
        pick(slots[j].ms, true);
      });
      grid.appendChild(b);
    });
    strip.innerHTML = "";
    strip.appendChild(grid);
  }

  function renderChosen(people) {
    var box = $("chosen");
    box.hidden = !chosen || people.length < 2;
    if (box.hidden) return;
    var s = slots.filter(function (x) { return x.ms === chosen; })[0];
    var h = G.local(people[0].zone, chosen);
    box.innerHTML = "<h3></h3>";
    box.firstChild.textContent = G.dayLabel(people[0].zone, chosen) + ", " + fmt(h.h * 60 + h.min) + " in " + people[0].city + " (" + state.length + " min)";
    var v = s ? verdict(s, people) : null;
    if (v) { var p = document.createElement("p"); p.style.margin = "0"; p.textContent = v.text + "."; box.appendChild(p); }
    box.appendChild(whoList(chosen, people));
  }

  function renderNotes(people) {
    var box = $("notes");
    box.innerHTML = "";
    if (people.length < 2 || !chosen) return;

    // Clock changes: a weekly meeting keeps its time in the host's city,
    // so anyone whose clocks change on a different date sees it move.
    if (state.weekly) {
      var drift = G.weeklyDrift(chosen, people[0].zone, people, 9);
      if (drift.moves.length) {
        var n = note("clock", "Heads up: clocks change in the next 8 weeks");
        var ul = document.createElement("ul");
        drift.moves.forEach(function (m) {
          var li = document.createElement("li");
          var p = people[m.person];
          li.textContent = "From " + G.dayLabel(people[0].zone, m.ms) + ", " + label(p, state.people.indexOf(p)) + "'s " + fmt(m.from) + " becomes " + fmt(m.to) + ".";
          ul.appendChild(li);
        });
        n.appendChild(ul);
        var why = document.createElement("p");
        why.textContent = "Countries change their clocks on different dates, so the gap between cities moves for a week or more. The meeting stays at the same time in " + people[0].city + ".";
        n.appendChild(why);
        box.appendChild(n);
        Sol.react("clock");
      }
    } else {
      var from = chosen - 7 * 864e5;
      var ch = G.clockChanges(people.map(function (p) { return p.zone; }), from, 14);
      if (ch.length) {
        var n2 = note("clock", "Clocks change near this day");
        ch.forEach(function (c) {
          var p = document.createElement("p");
          var who = people.filter(function (x) { return x.zone === c.zone; })[0];
          p.textContent = who.city + " moves " + (c.to > c.from ? "forward" : "back") + " an hour on " + G.dayLabel(c.zone, c.at) + ". The times above already count it, but a time agreed before then may not.";
          n2.appendChild(p);
        });
        box.appendChild(n2);
      }
    }

    // No time suits everyone: offer to take turns.
    if (top.length && top[0].worst >= G.COST.off) {
      var rot = G.rotation(slots, people);
      if (rot) {
        var n3 = note("rota", state.weekly ? "No time works for everyone. Take turns?" : "No time works for everyone");
        var pa = document.createElement("p");
        var ta = localMin(people[0].zone, rot.a.ms), tb = localMin(people[0].zone, rot.b.ms);
        pa.textContent = (state.weekly ? "Switch each week between " : "If you meet often, switch between ") + fmt(ta) + " and " + fmt(tb) + " " + people[0].city + " time. Nobody gets the hard time every week.";
        n3.appendChild(pa);
        var acts = document.createElement("div");
        acts.className = "actions";
        [rot.a, rot.b].forEach(function (s, i) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "btn ghost small";
          b.textContent = "See week " + (i ? "B" : "A") + " (" + fmt(localMin(people[0].zone, s.ms)) + ")";
          b.addEventListener("click", function () { pick(s.ms); });
          acts.appendChild(b);
        });
        n3.appendChild(acts);
        box.appendChild(n3);
        Sol.react("rota");
      }
    }
  }

  function note(kind, title) {
    var d = document.createElement("div");
    d.className = "note " + kind;
    var h = document.createElement("h3");
    h.textContent = title;
    d.appendChild(h);
    return d;
  }

  function pick(ms, fromStrip) {
    chosen = ms;
    render(true);
    var s = slots.filter(function (x) { return x.ms === ms; })[0];
    if (s) Sol.react(s.worst === 0 ? "pick:all" : s.feels.indexOf("night") >= 0 ? "pick:night" : "pick:some");
    if (fromStrip) {
      var col = $("strip").querySelector('[data-ms="' + ms + '"]');
      if (col) col.focus();
      return;
    }
    $("chosen").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function render(keepChosen) {
    var people = ready();
    slots = []; top = [];
    if (people.length >= 2 && G.parseDate(state.date)) {
      slots = G.day({ people: people, host: people[0].zone, date: state.date, length: state.length, step: 30 });
      top = G.best(slots, 3);
      var stillThere = slots.some(function (s) { return s.ms === chosen; });
      if (!keepChosen || !stillThere) chosen = top.length ? top[0].ms : null;
    } else {
      chosen = null;
    }
    renderPicks(people);
    renderStrip(people);
    renderChosen(people);
    renderNotes(people);
    $("share-actions").hidden = people.length < 2;
    var s = slots.filter(function (x) { return x.ms === chosen; })[0];
    Sol.context({
      people: people.length,
      typed: state.people.length,
      bad: state.people.some(function (p) { return (p.city.trim() && !p.zone) || !(p.end > p.start); }),
      feels: s ? s.feels : null
    });
  }

  var timer = 0, lastShape = "";
  function update() {
    refreshRows();
    clearTimeout(timer);
    timer = setTimeout(function () {
      // Keep the picked time if only names changed.
      var shape = JSON.stringify(ready().map(function (p) { return [p.zone, p.start, p.end, p.days]; })) + state.date + state.length;
      render(shape === lastShape);
      lastShape = shape;
      save();
    }, 120);
  }

  // ---------- day, length, style ----------
  // Today in the host's city, or tomorrow once their afternoon is under
  // way, skipping the weekend.
  function defaultDate(zone) {
    var l = G.local(zone || myZone(), Date.now());
    var add = l.h >= 15 ? 1 : 0;
    var wd = (l.wd + add) % 7;
    add += wd === 6 ? 2 : wd === 0 ? 1 : 0;
    var d = new Date(Date.UTC(l.y, l.m - 1, l.d + add));
    return d.toISOString().slice(0, 10);
  }

  $("date").addEventListener("change", function () { if (G.parseDate(this.value)) { state.date = this.value; update(); } });
  $("length").addEventListener("change", function () { state.length = +this.value; update(); });
  $("weekly").addEventListener("change", function () { state.weekly = this.checked; render(true); save(); if (state.weekly) Sol.react("weekly"); });
  $("style").addEventListener("change", function () {
    state.style = this.value;
    Array.prototype.forEach.call(list.children, function (node) {
      var p = node._person, h = node.querySelector('[data-k="hours"]');
      if (G.parseHours(h.value)) { h.value = hoursText(p); p.hours = h.value; }
    });
    refreshRows(); render(true); save();
  });

  $("add-person").addEventListener("click", function () {
    var p = blankPerson("");
    var last = state.people[state.people.length - 1];
    if (last) { p.start = last.start; p.end = last.end; p.days = last.days.slice(); p.hours = hoursText(last); }
    state.people.push(p);
    addPersonRow(p, true);
    update();
    Sol.react("added");
  });

  $("try-example").addEventListener("click", function () {
    load({
      people: [
        { name: "Ana", city: "New York", zone: "America/New_York", start: 540, end: 1020, days: [1, 2, 3, 4, 5] },
        { name: "Ben", city: "London", zone: "Europe/London", start: 540, end: 1050, days: [1, 2, 3, 4, 5] },
        { name: "Cy", city: "Manila", zone: "Asia/Manila", start: 480, end: 1020, days: [1, 2, 3, 4, 5] }
      ],
      weekly: true, length: 30
    });
    Sol.react("example");
  });

  // ---------- copy ----------
  function copy(text, okMsg) {
    var done = function () { $("status").textContent = okMsg; Sol.react("copied"); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }
  function fallback(text) {
    var t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } catch (e) {}
    t.remove();
  }

  $("copy-invite").addEventListener("click", function () {
    var people = ready();
    if (!chosen) return;
    copy(G.inviteText({
      people: people, ms: chosen, length: state.length, style: state.style,
      weekly: state.weekly, hostCity: people[0].city,
      title: "Meeting, " + state.length + " minutes"
    }), "Invite copied. Paste it into your message or calendar.");
  });
  // An .ics file: calendar apps on phones and desktops all open it.
  $("add-calendar").addEventListener("click", function () {
    var people = ready();
    if (!chosen) return;
    var title = "Meeting, " + state.length + " minutes";
    var ics = G.toIcs({
      ms: chosen, length: state.length, weekly: state.weekly, hostZone: people[0].zone,
      title: title,
      description: G.inviteText({ people: people, ms: chosen, length: state.length, style: state.style, weekly: state.weekly, hostCity: people[0].city, title: title })
    });
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = "goodhours-meeting.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    $("status").textContent = "Calendar file downloaded. Open it to add the meeting" + (state.weekly ? ", every week." : ".");
  });

  $("copy-link").addEventListener("click", function () {
    var url = location.href.split("#")[0] + "#" + G.encode(shareState());
    copy(url, "Link copied. Anyone who opens it sees the same people and day.");
  });

  function shareState() {
    return { people: ready(), date: state.date, length: state.length, weekly: state.weekly };
  }

  // ---------- save and load ----------
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ people: state.people, length: state.length, weekly: state.weekly, style: state.style }));
    } catch (e) {}
  }

  function load(s) {
    list.innerHTML = "";
    state.people = s.people.map(function (p) {
      var q = blankPerson("");
      q.name = p.name || ""; q.city = p.city || ""; q.zone = G.isZone(p.zone) ? p.zone : "";
      q.start = +p.start; q.end = +p.end; q.days = (p.days || []).slice();
      q.hours = hoursText(q);
      return q;
    });
    if (!state.people.length) state.people.push(blankPerson(myZone()));
    state.length = s.length || 30;
    state.weekly = !!s.weekly;
    if (s.style) state.style = s.style;
    var hz = state.people[0].zone || myZone();
    state.date = s.date && G.parseDate(s.date) && s.date >= defaultDate(hz) ? s.date : defaultDate(hz);
    $("date").value = state.date;
    $("date").min = G.dateKey(G.local(hz, Date.now()));
    $("length").value = String(state.length);
    $("weekly").checked = state.weekly;
    $("style").value = state.style;
    state.people.forEach(function (p) { addPersonRow(p, false); });
    lastShape = "";
    update();
  }

  var fromLink = G.decode(location.hash);
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (fromLink) {
    load(fromLink);
    setTimeout(function () { Sol.react("link"); }, 400);
  } else if (saved && saved.people && saved.people.length) {
    load(saved);
  } else {
    load({ people: [blankPerson(myZone())] });
  }

  // Keep the "now" clocks honest.
  setInterval(refreshRows, 30000);
})();
