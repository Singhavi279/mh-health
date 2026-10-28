/* Maharashtra Times Swasthya Sangam 2026: progressive enhancement only.
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
  var forms = document.querySelectorAll("form.form:not(.nom-form)");
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

  // Awards nomination pop-up: enquiry form -> (Pay Now: payment step) -> personalised confirmation.
  // Set data-payment-endpoint on <body>: POST {…enquiry, amount, currency} -> {paid:true} or {paymentUrl}.
  // Until the endpoints exist, the flow only runs on localhost (preview); on the live site it asks visitors to check back.
  (function () {
    var dlg = document.getElementById("nominate-dialog");
    var conf = document.getElementById("confirm-dialog");
    if (!dlg || !conf) return;

    var PAYMENT_ENDPOINT = document.body.getAttribute("data-payment-endpoint") || "";
    var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var form = dlg.querySelector("form");
    var viewForm = dlg.querySelector("[data-view=form]");
    var viewPay = dlg.querySelector("[data-view=pay]");
    var planSel = form.elements.plan;
    var formNote = viewForm.querySelector(".nom-note");
    var payNote = viewPay.querySelector("[data-pay-note]");
    var payBtn = viewPay.querySelector("[data-pay]");
    var otp = setupOtp(form);
    var plans = {};
    var pending = null;

    function inr(n) { return "Rs. " + Math.round(n).toLocaleString("en-IN"); }
    function otpOk() { return otp.isVerified() || (LOCAL && !OTP_SEND && !OTP_VERIFY); }

    // Plans: names and prices are fetched from the payment API; the cards only carry the product code.
    var PRODUCT_API = "https://api.indiatimes.com/eventhub/api/payment/get-product-details";
    var MCODE = "Pu22y3mrty";
    var cards = document.querySelectorAll(".plan[data-plan]");

    function planLabel(p) {
      return p.price == null ? p.name : p.name + " (" + inr(p.price) + " + GST)";
    }
    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute("data-plan");
      var p = plans[id] = { id: id, pcode: card.getAttribute("data-pcode"), name: card.querySelector(".plan-name").textContent, price: null, list: null, gst: 0, card: card, opt: document.createElement("option") };
      p.opt.value = id;
      p.opt.textContent = planLabel(p);
      planSel.appendChild(p.opt);
    });

    function renderPlan(p) {
      p.card.querySelector(".plan-name").textContent = p.name;
      p.opt.textContent = planLabel(p);
      var box = p.card.querySelector("[data-price-box]");
      var offer = p.card.querySelector(".plan-offer");
      box.textContent = "";
      if (p.price == null) {
        var na = document.createElement("span");
        na.className = "plan-loading";
        na.textContent = "Price unavailable right now. Please refresh the page.";
        box.appendChild(na);
        return;
      }
      var discounted = p.list != null && p.list > p.price;
      if (offer) offer.hidden = !discounted;
      if (discounted) {
        var del = document.createElement("del");
        var sr = document.createElement("span");
        sr.className = "sr-only"; sr.textContent = "Original price ";
        del.appendChild(sr);
        del.appendChild(document.createTextNode(inr(p.list)));
        box.appendChild(del);
        box.appendChild(document.createTextNode(" "));
      }
      var strong = document.createElement("strong");
      strong.appendChild(document.createTextNode(inr(p.price)));
      strong.appendChild(document.createElement("small")).textContent = " + GST";
      box.appendChild(strong);
    }
    function loadPlan(p) {
      var url = PRODUCT_API + "?pcode=" + encodeURIComponent(p.pcode) + "&mcode=" + MCODE + "&upcache=2";
      return fetch(url, { headers: { Accept: "application/json" } }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      }).then(function (d) {
        if (!d || (d.stts && d.stts !== 200) || !d.product_name) throw new Error("bad product");
        var list = d.couponList || [];
        var c = list.filter(function (x) { return x.default_coupon; })[0] || list[0];
        p.name = d.product_name;
        p.list = d.product_amount_without_gst;
        p.price = c ? c.final_billing_amount_without_gst : d.product_amount_without_gst;
        p.gst = c ? c.gst_on_final_billing_amount : d.gst;
      }).catch(function () {
        p.price = null;
      }).then(function () { renderPlan(p); });
    }
    Object.keys(plans).forEach(function (id) { loadPlan(plans[id]); });

    // Multi-select dropdown for segments of interest.
    var msel = dlg.querySelector(".msel");
    var mBtn = msel.querySelector(".msel-btn");
    var mText = msel.querySelector(".msel-text");
    var mPanel = msel.querySelector(".msel-panel");
    var EMPTY = "Select one or more segments";

    function chosenSegments() {
      return Array.prototype.map.call(mPanel.querySelectorAll("input:checked"), function (i) { return i.value; });
    }
    function mSummary() {
      var c = chosenSegments();
      mText.textContent = c.length ? c.join(", ") : EMPTY;
      mBtn.classList.toggle("has-value", c.length > 0);
    }
    function mToggle(open) {
      mPanel.hidden = !open;
      mBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function buildSegments() {
      var keep = chosenSegments();
      var segs = (window.SS_SEGMENTS || []).slice().sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); });
      mPanel.textContent = "";
      if (!segs.length) { mText.textContent = "Segments are loading…"; return; }
      segs.forEach(function (seg) {
        var lab = document.createElement("label");
        lab.className = "msel-opt";
        var cb = document.createElement("input");
        cb.type = "checkbox"; cb.name = "segments"; cb.value = seg.name;
        cb.checked = keep.indexOf(seg.name) > -1;
        lab.appendChild(cb);
        lab.appendChild(document.createElement("span")).textContent = seg.name;
        mPanel.appendChild(lab);
      });
      mSummary();
    }
    mBtn.addEventListener("click", function () { mToggle(mPanel.hidden); });
    mPanel.addEventListener("change", mSummary);
    dlg.addEventListener("click", function (e) { if (!msel.contains(e.target)) mToggle(false); });
    msel.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !mPanel.hidden) { e.preventDefault(); e.stopPropagation(); mToggle(false); mBtn.focus(); }
    });
    document.addEventListener("segments-loaded", buildSegments);

    // Open / close.
    function lock(on) { document.documentElement.classList.toggle("modal-open", on); }
    function show(d) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); lock(true); }
    function hide(d) {
      if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
      if (!dlg.open && !conf.open) lock(false);
    }
    function setView(name) {
      viewForm.hidden = name !== "form";
      viewPay.hidden = name !== "pay";
      dlg.scrollTop = 0;
    }
    function openNomination(planId) {
      setView("form");
      formNote.textContent = ""; payNote.textContent = "";
      if (planId && plans[planId]) planSel.value = planId;
      buildSegments();
      show(dlg);
    }
    document.addEventListener("click", function (e) {
      var t = e.target.closest('a[href="#nominate"], [data-open-nominate]');
      if (!t) return;
      e.preventDefault();
      var m = document.querySelector("details.menu");
      if (m) m.removeAttribute("open");
      openNomination(t.getAttribute("data-plan"));
    });
    if (location.hash === "#nominate") openNomination();

    [dlg, conf].forEach(function (d) {
      d.addEventListener("close", function () { if (!dlg.open && !conf.open) lock(false); });
      d.addEventListener("click", function (e) {
        if (e.target.closest("[data-close]")) return hide(d);
        var r = d.getBoundingClientRect();
        if (e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) hide(d);
      });
    });

    // Collect + send.
    function collect(intent) {
      var plan = plans[planSel.value];
      var f = form.elements;
      return {
        formType: "awards-nomination",
        intent: intent,
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        mobile: f.mobile.value,
        mobile_verified: otp.isVerified() ? "yes" : "no",
        designation: f.designation.value.trim(),
        organisation: f.organisation.value.trim(),
        plan: plan.name,
        plan_id: plan.id,
        amount_excl_gst: plan.price,
        gst: plan.gst,
        segments: chosenSegments(),
        description: f.description.value.trim(),
        terms: "yes"
      };
    }
    function send(data) {
      if (!FORM_ENDPOINT) return Promise.resolve({});
      return postJSON(FORM_ENDPOINT, data);
    }

    function fill(root, key, text) {
      var n = root.querySelector('[data-fill="' + key + '"]');
      if (n) n.textContent = text;
    }
    function finish(data) {
      var first = data.name.split(/\s+/)[0];
      fill(conf, "first", first);
      fill(conf, "plan", data.amount_excl_gst == null ? data.plan : data.plan + " (" + inr(data.amount_excl_gst) + " + GST)");
      fill(conf, "segments", data.segments.join(", "));
      fill(conf, "reach", "+91 " + data.mobile + " · " + data.email);
      hide(dlg);
      form.reset(); otp.reset(); mToggle(false); buildSegments(); setView("form");
      show(conf);
      conf.querySelector(".conf-done").focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var intent = (e.submitter && e.submitter.value) || "later";
      formNote.textContent = "";
      if (!otpOk()) { otp.say("Please verify your mobile number with the OTP before submitting."); otp.focus(); formNote.textContent = "Please verify your mobile number to continue."; return; }
      if (!chosenSegments().length) { formNote.textContent = "Please choose at least one segment of interest."; mToggle(true); mBtn.focus(); return; }
      if (!FORM_ENDPOINT && !LOCAL) { formNote.textContent = "Online submissions open soon. Please check back or contact the team below."; return; }

      if (intent === "now" && plans[planSel.value].price == null) { formNote.textContent = "The price for this plan is unavailable right now. Please choose Pay Later or try again shortly."; return; }
      var data = collect(intent);
      var btns = form.querySelectorAll(".nom-actions button");
      var labels = Array.prototype.map.call(btns, function (b) { return b.textContent; });
      Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
      e.submitter.textContent = "Sending…";
      send(data).then(function () {
        if (intent === "now") {
          pending = data;
          var plan = plans[data.plan_id], gst = plan.gst;
          fill(viewPay, "plan", plan.name);
          fill(viewPay, "subtotal", inr(plan.price));
          fill(viewPay, "gstlabel", "GST (" + Math.round(gst / plan.price * 100) + "%)");
          fill(viewPay, "gst", inr(gst));
          fill(viewPay, "total", inr(plan.price + gst));
          payBtn.textContent = "Pay " + inr(plan.price + gst);
          payNote.textContent = "";
          setView("pay");
          payBtn.focus();
        } else {
          finish(data);
        }
      }).catch(function () {
        formNote.textContent = "Something went wrong. Please try again.";
      }).finally(function () {
        Array.prototype.forEach.call(btns, function (b, i) { b.disabled = false; b.textContent = labels[i]; });
      });
    });

    viewPay.querySelector("[data-back]").addEventListener("click", function () { setView("form"); });

    payBtn.addEventListener("click", function () {
      if (!pending) return;
      if (!PAYMENT_ENDPOINT) {
        if (LOCAL) return finish(pending);
        payNote.textContent = "Online payment opens soon. Please go back and choose Pay Later, and our team will share the payment details.";
        return;
      }
      var plan = plans[pending.plan_id], total = plan.price + plan.gst;
      var label = payBtn.textContent;
      payBtn.disabled = true; payBtn.textContent = "Processing…"; payNote.textContent = "";
      postJSON(PAYMENT_ENDPOINT, Object.assign({}, pending, { amount: Math.round(total), currency: "INR" })).then(function (r) {
        if (r && r.paymentUrl) { location.href = r.paymentUrl; return; }
        if (!r || r.paid !== true) throw new Error("not paid");
        finish(pending);
      }).catch(function () {
        payNote.textContent = "We could not complete the payment. Please try again or choose Pay Later.";
      }).finally(function () { payBtn.disabled = false; payBtn.textContent = label; });
    });
  })();
})();

// Awards page: fetch segment-wise award categories from the Eventhub API and render them.
(function () {
  "use strict";
  var box = document.getElementById("award-segments");
  if (!box) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  function byOrder(a, b) { return (a.display_order || 0) - (b.display_order || 0); }

  var COLORS = ["#34609f", "#2f9a6a", "#d39a2c", "#8a5cc0", "#d63a7a", "#1a8a8a"];

  function render(segments) {
    box.textContent = "";
    segments = segments.slice().sort(byOrder);
    window.SS_SEGMENTS = segments;
    document.dispatchEvent(new CustomEvent("segments-loaded"));
    var tabs = el("div", "seg-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Award segments");
    tabs.setAttribute("aria-orientation", "vertical");
    var panels = el("div", "seg-panels");
    var btns = [], pans = [];

    function activate(i, focus) {
      btns.forEach(function (b, k) {
        var on = k === i;
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        pans[k].hidden = !on;
      });
      if (focus) btns[i].focus();
    }

    segments.forEach(function (seg, i) {
      var kids = (seg.children || []).slice().sort(byOrder);
      var color = COLORS[i % COLORS.length];

      var btn = el("button", "seg-tab");
      btn.type = "button";
      btn.id = "seg-tab-" + i;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-controls", "seg-panel-" + i);
      btn.style.setProperty("--c", color);
      btn.appendChild(el("span", "seg-tab-name", seg.name));
      btn.appendChild(el("span", "seg-tab-count", kids.length + (kids.length === 1 ? " category" : " categories")));
      btn.addEventListener("click", function () { activate(i); });
      btn.addEventListener("keydown", function (e) {
        var n = btns.length, k = -1;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") k = (i + 1) % n;
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") k = (i - 1 + n) % n;
        else if (e.key === "Home") k = 0;
        else if (e.key === "End") k = n - 1;
        if (k < 0) return;
        e.preventDefault();
        activate(k, true);
      });
      tabs.appendChild(btn);
      btns.push(btn);

      var pan = el("div", "seg-panel");
      pan.id = "seg-panel-" + i;
      pan.setAttribute("role", "tabpanel");
      pan.setAttribute("aria-labelledby", btn.id);
      pan.style.setProperty("--c", color);
      kids.forEach(function (c, ci) {
        var d = el("details", "cat");
        d.name = "cats-" + i;
        if (ci === 0) d.open = true;
        var s = el("summary", "cat-name", c.name);
        d.appendChild(s);
        var body = el("div", "cat-body");
        if (c.description) body.appendChild(el("p", "cat-desc", c.description));
        var who = c.custom_fields && c.custom_fields.who_can_apply;
        if (who) {
          var p = el("p", "cat-who");
          p.appendChild(el("strong", "", "Who can apply: "));
          p.appendChild(document.createTextNode(who));
          body.appendChild(p);
        }
        d.appendChild(body);
        pan.appendChild(d);
      });
      panels.appendChild(pan);
      pans.push(pan);

    });

    var total = segments.reduce(function (n, s) { return n + (s.children || []).length; }, 0);
    var summary = document.getElementById("award-summary");
    if (summary) summary.textContent = total + " award categories across " + segments.length + " segments.";

    box.appendChild(tabs);
    box.appendChild(panels);
    activate(0);
  }

  fetch(box.getAttribute("data-api"), { headers: { Accept: "application/json" } })
    .then(function (res) { if (!res.ok) throw new Error("bad status"); return res.json(); })
    .then(function (json) {
      var segs = json && json.data && json.data.segments;
      if (!segs || !segs.length) throw new Error("no data");
      render(segs);
    })
    .catch(function () {
      box.textContent = "";
      box.appendChild(el("p", "tba", "Award categories could not be loaded right now. Please refresh or try again shortly."));
    });
})();

// Hero effects for hover-capable screens: cursor spotlight and 3D tilt
(function () {
  "use strict";

  var hero = document.querySelector("[data-hero]");
  if (!hero) return;

  // 1. Cursor spotlight tracking
  if (window.matchMedia("(hover: hover)").matches) {
    hero.addEventListener("pointermove", function (e) {
      var rect = hero.getBoundingClientRect();
      hero.style.setProperty("--mouse-x", e.clientX - rect.left + "px");
      hero.style.setProperty("--mouse-y", e.clientY - rect.top + "px");
    });
  }

  // 2. Interactive 3D Tilt on Showcase Card
  var card = hero.querySelector("[data-tilt]");
  if (card && window.matchMedia("(hover: hover) and (min-width: 992px)").matches) {
    var isHovered = false;
    var raf = null;
    var targetX = 0, targetY = 0;
    var currentX = 0, currentY = 0;

    function animateTilt() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      card.style.transform = "perspective(1000px) rotateX(" + currentX.toFixed(2) + "deg) rotateY(" + currentY.toFixed(2) + "deg) translateY(-4px)";
      if (isHovered || Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
        raf = requestAnimationFrame(animateTilt);
      } else {
        card.style.transform = "";
        raf = null;
      }
    }

    card.addEventListener("pointerenter", function () {
      isHovered = true;
      if (!raf) raf = requestAnimationFrame(animateTilt);
    });

    card.addEventListener("pointermove", function (e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      var y = (e.clientY - rect.top) / rect.height;
      targetX = (0.5 - y) * 14;
      targetY = (x - 0.5) * 14;
      if (!raf) raf = requestAnimationFrame(animateTilt);
    });

    card.addEventListener("pointerleave", function () {
      isHovered = false;
      targetX = 0;
      targetY = 0;
    });
  }
})();

// Summit page: awards teaser fed by the same Eventhub categories API as the Awards page.
(function () {
  "use strict";
  var list = document.getElementById("at-segments");
  if (!list) return;
  var COLORS = ["#6fa0e6", "#52b83a", "#f2c14e", "#b48be6"];
  var API = "https://api.indiatimes.com/eventhub/api/portal/events/MAHARASHTRA_TIMES_SWASTHYA_SANGAM_2026/categories";
  fetch(API, { headers: { Accept: "application/json" } })
    .then(function (r) { if (!r.ok) throw new Error("bad status"); return r.json(); })
    .then(function (json) {
      var segs = json && json.data && json.data.segments;
      if (!segs || !segs.length) throw new Error("no data");
      segs = segs.slice().sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); });
      list.textContent = "";
      var total = 0;
      segs.forEach(function (s, i) {
        var n = (s.children || []).length;
        total += n;
        var li = document.createElement("li");
        li.style.setProperty("--c", COLORS[i % COLORS.length]);
        li.appendChild(document.createElement("span")).textContent = s.name;
        li.appendChild(document.createElement("small")).textContent = n + (n === 1 ? " category" : " categories");
        list.appendChild(li);
      });
      var count = document.getElementById("at-count");
      if (count) { count.textContent = total + " award categories across " + segs.length + " segments"; count.hidden = false; }
    })
    .catch(function () { list.hidden = true; });
})();
