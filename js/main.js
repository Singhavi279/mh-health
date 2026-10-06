/* Maharashtra Times Swasthya Sangam 2026 — progressive enhancement only.
   The page is fully readable without JavaScript. */
(function () {
  "use strict";

  // Set this (or data-form-endpoint on <body> in index.html) to a form service URL,
  // e.g. Formspree / Google Apps Script / your own API. Receives JSON via POST.
  var FORM_ENDPOINT = document.body.getAttribute("data-form-endpoint") || "";

  // Close the mobile menu after a link is tapped.
  var menu = document.querySelector("details.menu");
  if (menu) {
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) menu.removeAttribute("open");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") menu.removeAttribute("open");
    });
  }

  // Enquiry forms (nomination + registration).
  var forms = document.querySelectorAll("form.form");
  Array.prototype.forEach.call(forms, function (form) {
    var note = form.querySelector(".form-note");
    var button = form.querySelector("button[type=submit]");
    var label = button ? button.textContent : "";
    var formType = (form.querySelector("input,select,textarea") || {}).id || "";
    formType = formType.split("-")[0] || "form";

    function say(msg) { if (note) note.textContent = msg; }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!FORM_ENDPOINT) return say("Online submissions open soon. Please check back or use the contact details below.");
      var payload = { formType: formType };
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      button.disabled = true; button.textContent = "Sending…";
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        form.reset();
        say("Thank you. We have received your details and will be in touch.");
      }).catch(function () {
        say("Something went wrong. Please try again.");
      }).finally(function () {
        button.disabled = false; button.textContent = label;
      });
    });
  });
})();
