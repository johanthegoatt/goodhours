// Cities people type when they set up a call, mapped to IANA zones.
// Each entry: [city, country, zone]. Search matches the start of any word,
// the country, or the zone name, so "kolkata", "india", "calcutta" and
// "Asia/Kolkata" all find the same place.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GoodHoursCities = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var LIST = [
    ["New York", "United States", "America/New_York"],
    ["Boston", "United States", "America/New_York"],
    ["Washington DC", "United States", "America/New_York"],
    ["Miami", "United States", "America/New_York"],
    ["Atlanta", "United States", "America/New_York"],
    ["Toronto", "Canada", "America/Toronto"],
    ["Montreal", "Canada", "America/Toronto"],
    ["Chicago", "United States", "America/Chicago"],
    ["Dallas", "United States", "America/Chicago"],
    ["Houston", "United States", "America/Chicago"],
    ["Austin", "United States", "America/Chicago"],
    ["Mexico City", "Mexico", "America/Mexico_City"],
    ["Denver", "United States", "America/Denver"],
    ["Phoenix", "United States", "America/Phoenix"],
    ["Calgary", "Canada", "America/Edmonton"],
    ["Los Angeles", "United States", "America/Los_Angeles"],
    ["San Francisco", "United States", "America/Los_Angeles"],
    ["Seattle", "United States", "America/Los_Angeles"],
    ["Vancouver", "Canada", "America/Vancouver"],
    ["Anchorage", "United States", "America/Anchorage"],
    ["Honolulu", "United States", "Pacific/Honolulu"],
    ["Halifax", "Canada", "America/Halifax"],
    ["St. John's", "Canada", "America/St_Johns"],
    ["Puerto Rico", "United States", "America/Puerto_Rico"],
    ["Bogota", "Colombia", "America/Bogota"],
    ["Lima", "Peru", "America/Lima"],
    ["Caracas", "Venezuela", "America/Caracas"],
    ["Santiago", "Chile", "America/Santiago"],
    ["Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires"],
    ["Sao Paulo", "Brazil", "America/Sao_Paulo"],
    ["Rio de Janeiro", "Brazil", "America/Sao_Paulo"],
    ["Montevideo", "Uruguay", "America/Montevideo"],
    ["Reykjavik", "Iceland", "Atlantic/Reykjavik"],
    ["Lisbon", "Portugal", "Europe/Lisbon"],
    ["London", "United Kingdom", "Europe/London"],
    ["Manchester", "United Kingdom", "Europe/London"],
    ["Edinburgh", "United Kingdom", "Europe/London"],
    ["Dublin", "Ireland", "Europe/Dublin"],
    ["Paris", "France", "Europe/Paris"],
    ["Madrid", "Spain", "Europe/Madrid"],
    ["Barcelona", "Spain", "Europe/Madrid"],
    ["Amsterdam", "Netherlands", "Europe/Amsterdam"],
    ["Brussels", "Belgium", "Europe/Brussels"],
    ["Berlin", "Germany", "Europe/Berlin"],
    ["Munich", "Germany", "Europe/Berlin"],
    ["Zurich", "Switzerland", "Europe/Zurich"],
    ["Rome", "Italy", "Europe/Rome"],
    ["Milan", "Italy", "Europe/Rome"],
    ["Vienna", "Austria", "Europe/Vienna"],
    ["Prague", "Czechia", "Europe/Prague"],
    ["Warsaw", "Poland", "Europe/Warsaw"],
    ["Copenhagen", "Denmark", "Europe/Copenhagen"],
    ["Stockholm", "Sweden", "Europe/Stockholm"],
    ["Oslo", "Norway", "Europe/Oslo"],
    ["Helsinki", "Finland", "Europe/Helsinki"],
    ["Athens", "Greece", "Europe/Athens"],
    ["Bucharest", "Romania", "Europe/Bucharest"],
    ["Kyiv", "Ukraine", "Europe/Kyiv"],
    ["Istanbul", "Turkey", "Europe/Istanbul"],
    ["Moscow", "Russia", "Europe/Moscow"],
    ["Cairo", "Egypt", "Africa/Cairo"],
    ["Lagos", "Nigeria", "Africa/Lagos"],
    ["Accra", "Ghana", "Africa/Accra"],
    ["Casablanca", "Morocco", "Africa/Casablanca"],
    ["Nairobi", "Kenya", "Africa/Nairobi"],
    ["Addis Ababa", "Ethiopia", "Africa/Addis_Ababa"],
    ["Johannesburg", "South Africa", "Africa/Johannesburg"],
    ["Cape Town", "South Africa", "Africa/Johannesburg"],
    ["Tel Aviv", "Israel", "Asia/Jerusalem"],
    ["Jerusalem", "Israel", "Asia/Jerusalem"],
    ["Riyadh", "Saudi Arabia", "Asia/Riyadh"],
    ["Doha", "Qatar", "Asia/Qatar"],
    ["Dubai", "United Arab Emirates", "Asia/Dubai"],
    ["Abu Dhabi", "United Arab Emirates", "Asia/Dubai"],
    ["Tehran", "Iran", "Asia/Tehran"],
    ["Karachi", "Pakistan", "Asia/Karachi"],
    ["Lahore", "Pakistan", "Asia/Karachi"],
    ["Mumbai", "India", "Asia/Kolkata"],
    ["Delhi", "India", "Asia/Kolkata"],
    ["Bangalore", "India", "Asia/Kolkata"],
    ["Bengaluru", "India", "Asia/Kolkata"],
    ["Kolkata", "India", "Asia/Kolkata"],
    ["Chennai", "India", "Asia/Kolkata"],
    ["Hyderabad", "India", "Asia/Kolkata"],
    ["Colombo", "Sri Lanka", "Asia/Colombo"],
    ["Kathmandu", "Nepal", "Asia/Kathmandu"],
    ["Dhaka", "Bangladesh", "Asia/Dhaka"],
    ["Yangon", "Myanmar", "Asia/Yangon"],
    ["Bangkok", "Thailand", "Asia/Bangkok"],
    ["Ho Chi Minh City", "Vietnam", "Asia/Ho_Chi_Minh"],
    ["Hanoi", "Vietnam", "Asia/Bangkok"],
    ["Jakarta", "Indonesia", "Asia/Jakarta"],
    ["Bali", "Indonesia", "Asia/Makassar"],
    ["Kuala Lumpur", "Malaysia", "Asia/Kuala_Lumpur"],
    ["Singapore", "Singapore", "Asia/Singapore"],
    ["Manila", "Philippines", "Asia/Manila"],
    ["Cebu", "Philippines", "Asia/Manila"],
    ["Davao", "Philippines", "Asia/Manila"],
    ["Hong Kong", "Hong Kong", "Asia/Hong_Kong"],
    ["Shanghai", "China", "Asia/Shanghai"],
    ["Beijing", "China", "Asia/Shanghai"],
    ["Shenzhen", "China", "Asia/Shanghai"],
    ["Taipei", "Taiwan", "Asia/Taipei"],
    ["Seoul", "South Korea", "Asia/Seoul"],
    ["Tokyo", "Japan", "Asia/Tokyo"],
    ["Osaka", "Japan", "Asia/Tokyo"],
    ["Perth", "Australia", "Australia/Perth"],
    ["Darwin", "Australia", "Australia/Darwin"],
    ["Adelaide", "Australia", "Australia/Adelaide"],
    ["Brisbane", "Australia", "Australia/Brisbane"],
    ["Sydney", "Australia", "Australia/Sydney"],
    ["Melbourne", "Australia", "Australia/Melbourne"],
    ["Hobart", "Australia", "Australia/Hobart"],
    ["Auckland", "New Zealand", "Pacific/Auckland"],
    ["Wellington", "New Zealand", "Pacific/Auckland"],
    ["Fiji", "Fiji", "Pacific/Fiji"]
  ];

  // Old names people still type.
  var ALIAS = {
    calcutta: "Kolkata", bombay: "Mumbai", "new delhi": "Delhi", saigon: "Ho Chi Minh City",
    nyc: "New York", la: "Los Angeles", sf: "San Francisco", kiev: "Kyiv", peking: "Beijing",
    "uk": "London", "usa": "New York", "sao paolo": "Sao Paulo", "são paulo": "Sao Paulo", dc: "Washington DC"
  };

  function fold(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_/]/g, " ").trim();
  }

  function search(q, limit) {
    var f = fold(q);
    if (!f) return [];
    if (ALIAS[f]) f = fold(ALIAS[f]);
    var scored = [];
    LIST.forEach(function (c) {
      var name = fold(c[0]), country = fold(c[1]), zone = fold(c[2]);
      var score = -1;
      if (name === f) score = 0;
      else if (name.indexOf(f) === 0) score = 1;
      else if ((" " + name).indexOf(" " + f) >= 0) score = 2;
      else if (country.indexOf(f) === 0 || zone.indexOf(f) >= 0) score = 3;
      if (score >= 0) scored.push({ s: score, c: c });
    });
    scored.sort(function (a, b) { return a.s - b.s || a.c[0].localeCompare(b.c[0]); });
    return scored.slice(0, limit || 8).map(function (x) { return { city: x.c[0], country: x.c[1], zone: x.c[2] }; });
  }

  // Name a zone the browser reports, e.g. "Asia/Manila" -> Manila.
  function fromZone(zone) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i][2] === zone) return { city: LIST[i][0], country: LIST[i][1], zone: zone };
    var last = String(zone).split("/").pop().replace(/_/g, " ");
    return { city: last, country: "", zone: zone };
  }

  return { LIST: LIST, search: search, fromZone: fromZone };
});
