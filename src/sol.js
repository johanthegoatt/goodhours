// Sol, the sun who helps you find a time. Sol shows how the time you're
// looking at feels: a bright sun when it's work hours for everyone, an
// orange evening sun when someone is stretching, and a sleepy moon with
// stars when it's the middle of the night for someone. Sol's eyes follow
// your pointer (or the box you're typing in), a tap gives a tip for the
// step you're on, and five quick taps make Sol spin. Everything Sol says
// goes through the bubble's live region, so screen readers hear it too.
(function () {
  "use strict";
  var btn = document.getElementById("sol");
  var bubble = document.getElementById("sol-bubble");
  var dock = document.getElementById("sol-dock");
  var hide = document.getElementById("sol-hide");
  if (!btn) {
    window.Sol = { context: function () {}, react: function () {}, say: function () {} };
    return;
  }

  var still = matchMedia("(prefers-reduced-motion: reduce)");
  var baseMood = "sleepy", tipKey = "start";
  var flashing = false, flashTimer = null, bubbleTimer = null, tapTimes = [], tipIndex = {};
  var greeted = false, cheered = false, said = {};

  var TIPS = {
    start: [
      "Hi, I'm Sol! Start with your own city and the hours you work.",
      "Then tap Add someone for each person in the meeting.",
      "Want to see how it works first? Tap Try an example."
    ],
    people: [
      "Type a city and pick it from the list. I know over a hundred.",
      "Hours can be 9-5, 8:30am-4pm or even 22:00-06:00 for night shifts.",
      "Not everyone works Monday to Friday. Tap the days to change them."
    ],
    result: [
      "Green means work hours. Amber means a bit early or late. Dark blue means asleep.",
      "Tap any time in the day strip to see it for everyone.",
      "Tick It repeats every week and I'll warn you when clocks change.",
      "Copy invite text gives everyone the time in their own city."
    ],
    bad: [
      "I can't find that city. Try a bigger city nearby in the same country.",
      "Hours look odd to me. Try 9-5, or 9am-5:30pm."
    ]
  };

  function setMood(m) { btn.setAttribute("data-mood", m); }
  function setSky(s) { btn.setAttribute("data-sky", s); }

  function say(text, ms) {
    if (dock.classList.contains("tucked")) return;
    bubble.textContent = text;
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.textContent = ""; }, ms || 7000);
  }

  // Say a line only the first time it comes up.
  function once(key, text, ms) {
    if (said[key]) return;
    said[key] = true;
    say(text, ms);
  }

  function flash(m, ms) {
    setMood(m);
    flashing = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { flashing = false; setMood(baseMood); }, ms || 1400);
  }

  function play(cls) {
    if (still.matches) return;
    btn.classList.remove("hop", "wobble");
    void btn.offsetWidth;
    btn.classList.add(cls);
  }
  btn.addEventListener("animationend", function (e) {
    if (e.animationName === "hop" || e.animationName === "wobble") btn.classList.remove("hop", "wobble");
  });

  function context(c) {
    var sky = "day";
    if (c.bad) { tipKey = "bad"; baseMood = "worried"; }
    else if (c.people < 2) { tipKey = c.typed > 1 || c.people === 1 ? "people" : "start"; baseMood = c.people ? "happy" : "sleepy"; }
    else {
      tipKey = "result";
      var f = c.feels || [];
      if (f.indexOf("night") >= 0) { sky = "night"; baseMood = "sleepy"; }
      else if (f.indexOf("off") >= 0 || f.indexOf("edge") >= 0) { sky = "dusk"; baseMood = "happy"; }
      else { baseMood = "happy"; }
      if (f.length && f.every(function (x) { return x === "work"; }) && !cheered) {
        cheered = true;
        play("hop");
        flash("party", 1600);
        sparks(10);
        say("Found one! That time is inside everyone's work hours.");
      }
    }
    setSky(sky);
    btn.setAttribute("aria-label", "Sol the sun. " + (sky === "night" ? "It's night for someone at this time. " : "") + "Tap for a tip.");
    if (!flashing) setMood(baseMood);
    if (!greeted) {
      greeted = true;
      setTimeout(function () { if (!bubble.textContent && tipKey === "start") say(TIPS.start[0], 9000); }, 900);
    }
  }

  function nextTip() {
    var list = TIPS[tipKey] || TIPS.result;
    var i = tipIndex[tipKey] || 0;
    tipIndex[tipKey] = (i + 1) % list.length;
    return list[i];
  }

  btn.addEventListener("click", function () {
    if (dock.classList.contains("tucked")) {
      dock.classList.remove("tucked");
      remember(false);
      say("I'm back! Tap me any time for a tip.");
      play("hop");
      return;
    }
    var now = Date.now();
    tapTimes = tapTimes.filter(function (t) { return now - t < 1600; });
    tapTimes.push(now);
    if (tapTimes.length >= 5) {
      tapTimes = [];
      play("wobble");
      flash("wow", 1200);
      sparks(14);
      say(btn.getAttribute("data-sky") === "night" ? "Shh! Some of us are trying to sleep." : "Whoa, I'm seeing spots! Too bright!");
      return;
    }
    play("hop");
    if (baseMood === "sleepy") flash("happy", 1600);
    say(nextTip());
  });

  hide.addEventListener("click", function () {
    dock.classList.add("tucked");
    bubble.textContent = "";
    remember(true);
  });

  function remember(tucked) {
    try { localStorage.setItem("goodhours.solTucked", tucked ? "1" : ""); } catch (e) {}
  }
  try { if (localStorage.getItem("goodhours.solTucked")) dock.classList.add("tucked"); } catch (e) {}

  // Eyes follow the pointer, a few pixels at most.
  var pupils = btn.querySelectorAll(".s-pupil");
  var target = null, frame = 0;
  function look() {
    frame = 0;
    if (!target) return;
    var r = btn.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height * 0.47;
    var dx = target.x - cx, dy = target.y - cy;
    var d = Math.hypot(dx, dy) || 1;
    var reach = Math.min(1, d / 220);
    var x = (dx / d) * 3 * reach, y = (dy / d) * 3.4 * reach;
    pupils.forEach(function (p) { p.style.transform = "translate(" + x.toFixed(2) + "px," + y.toFixed(2) + "px)"; });
  }
  window.addEventListener("pointermove", function (ev) {
    target = { x: ev.clientX, y: ev.clientY };
    if (!frame) frame = requestAnimationFrame(look);
  }, { passive: true });
  document.addEventListener("focusin", function (ev) {
    var r = ev.target.getBoundingClientRect && ev.target.getBoundingClientRect();
    if (!r || ev.target === btn) return;
    target = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (!frame) frame = requestAnimationFrame(look);
  });

  (function blink() {
    setTimeout(function () {
      if (baseMood !== "sleepy" && !document.hidden) {
        btn.classList.add("blink");
        setTimeout(function () { btn.classList.remove("blink"); }, 140);
      }
      blink();
    }, 2600 + Math.random() * 3800);
  })();

  // Little sparks of sunshine fly out and fade.
  function sparks(n) {
    if (still.matches) return;
    var r = btn.getBoundingClientRect();
    var night = btn.getAttribute("data-sky") === "night";
    for (var i = 0; i < n; i++) {
      var s = document.createElement("span");
      s.className = "spark";
      if (night) s.style.background = "#e9e6ff";
      s.style.left = r.left + r.width / 2 + "px";
      s.style.top = r.top + r.height / 2 + "px";
      document.body.appendChild(s);
      var a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var dist = 60 + Math.random() * 60;
      var anim = s.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + Math.cos(a) * dist + "px," + Math.sin(a) * dist + "px) scale(0.3)", opacity: 0 }
      ], { duration: 800 + Math.random() * 400, easing: "ease-out" });
      anim.onfinish = (function (node) { return function () { node.remove(); }; })(s);
    }
  }

  function react(what) {
    switch (String(what)) {
      case "focus:city": once("city", "Type a city. Big cities near you work too, as long as they share your clock.", 5000); break;
      case "focus:hours": once("hours", "Any way you write it is fine: 9-5, 8:30am-4pm, 22:00-06:00.", 5000); break;
      case "city": play("hop"); break;
      case "added": play("hop"); once("added", "New person! I copied the hours from the last one. Change them if theirs are different."); break;
      case "example": play("hop"); say("Here's a team in New York, London and Manila. Tough one! Look at the notes below the times."); break;
      case "link": play("hop"); say("Someone shared this with you. Add yourself if you're not on the list."); break;
      case "pick:all": play("hop"); flash("party", 1000); break;
      case "pick:night": flash("wow", 900); once("night", "Yawn! That one is the middle of the night for someone.", 5000); break;
      case "pick:some": break;
      case "weekly": say("Every week? I'll check the next 8 weeks for clock changes."); break;
      case "clock": once("clock", "Clocks change soon for someone. I listed what moves below.", 6000); break;
      case "rota": once("rota", "Nobody's day lines up. Taking turns shares the late nights fairly.", 6000); break;
      case "copied": play("hop"); flash("party", 1200); sparks(8); say("Copied! Send it over."); break;
    }
  }

  window.Sol = { react: react, context: context, say: say };
})();
