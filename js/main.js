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

  // Mobile OTP verification. Set data-otp-send-endpoint and data-otp-verify-endpoint on <body>.
  //   send:   POST {mobile}       -> 2xx when the OTP SMS is sent
  //   verify: POST {mobile, otp}  -> 2xx (optionally {verified:true}) when the OTP matches
  var OTP_SEND = document.body.getAttribute("data-otp-send-endpoint") || "";
  var OTP_VERIFY = document.body.getAttribute("data-otp-verify-endpoint") || "";

  function postJSON(url, data) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json().catch(function () { return {}; });
    });
  }

  function setupOtp(form) {
    var box = form.querySelector("[data-otp]");
    if (!box) return { isVerified: function () { return true; }, focus: function () {} };
    var mobile = box.querySelector("input[name=mobile]");
    var sendBtn = box.querySelector(".otp-send");
    var verifyRow = box.querySelector(".otp-verify");
    var otpInput = verifyRow.querySelector("input");
    var confirmBtn = box.querySelector(".otp-confirm");
    var flag = box.querySelector("input[name=mobile_verified]");
    var note = box.querySelector(".otp-note");
    var verified = false, timer = null;

    function say(msg, ok) { note.textContent = msg; note.className = "otp-note" + (ok ? " is-ok" : ""); }
    function reset() {
      verified = false; flag.value = "no";
      mobile.readOnly = false; sendBtn.disabled = false; sendBtn.textContent = "Send OTP";
      verifyRow.hidden = true; otpInput.value = "";
      clearInterval(timer);
    }
    function cooldown(sec) {
      sendBtn.disabled = true;
      clearInterval(timer);
      timer = setInterval(function () {
        sec -= 1;
        if (sec <= 0) { clearInterval(timer); sendBtn.disabled = false; sendBtn.textContent = "Resend OTP"; }
        else sendBtn.textContent = "Resend in " + sec + "s";
      }, 1000);
      sendBtn.textContent = "Resend in " + sec + "s";
    }

    mobile.addEventListener("input", function () {
      mobile.value = mobile.value.replace(/\D/g, "").slice(0, 10);
      if (verified || !verifyRow.hidden) { reset(); say(""); }
    });

    sendBtn.addEventListener("click", function () {
      if (!/^[6-9]\d{9}$/.test(mobile.value)) { say("Enter a valid 10-digit mobile number."); mobile.focus(); return; }
      if (!OTP_SEND) return say("OTP verification is not live yet. Please check back soon.");
      sendBtn.disabled = true; say("Sending OTP…");
      postJSON(OTP_SEND, { mobile: mobile.value }).then(function () {
        verifyRow.hidden = false; otpInput.focus(); cooldown(30);
        say("OTP sent to +91 " + mobile.value + ".", true);
      }).catch(function () {
        sendBtn.disabled = false; say("Could not send the OTP. Please try again.");
      });
    });

    confirmBtn.addEventListener("click", function () {
      if (!/^\d{6}$/.test(otpInput.value)) { say("Enter the 6-digit OTP."); otpInput.focus(); return; }
      if (!OTP_VERIFY) return say("OTP verification is not live yet. Please check back soon.");
      confirmBtn.disabled = true; say("Verifying…");
      postJSON(OTP_VERIFY, { mobile: mobile.value, otp: otpInput.value }).then(function (r) {
        if (r && r.verified === false) throw new Error("mismatch");
        verified = true; flag.value = "yes"; mobile.readOnly = true;
        verifyRow.hidden = true; clearInterval(timer);
        sendBtn.disabled = true; sendBtn.textContent = "Verified ✓";
        say("Mobile number verified.", true);
      }).catch(function () {
        say("Incorrect or expired OTP. Please try again.");
      }).finally(function () { confirmBtn.disabled = false; });
    });

    return {
      isVerified: function () { return verified; },
      focus: function () { mobile.focus(); },
      say: say,
      reset: function () { reset(); say(""); }
    };
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
    var otp = setupOtp(form);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!otp.isVerified()) { otp.say("Please verify your mobile number with the OTP before submitting."); otp.focus(); return say("Please verify your mobile number to continue."); }
      if (!FORM_ENDPOINT) return say("Online submissions open soon. Please check back or use the contact details below.");
      var payload = { formType: formType };
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      Array.prototype.forEach.call(form.querySelectorAll("input[type=checkbox]"), function (c) {
        payload[c.name] = c.checked ? "yes" : "no";
      });
      button.disabled = true; button.textContent = "Sending…";
      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        form.reset();
        otp.reset();
        say("Thank you. We have received your details and will be in touch.");
      }).catch(function () {
        say("Something went wrong. Please try again.");
      }).finally(function () {
        button.disabled = false; button.textContent = label;
      });
    });
  });
})();
