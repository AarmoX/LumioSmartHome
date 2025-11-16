/* ===== DOM helpers ===== */
(function () {
    const qs = (s, root = document) => root.querySelector(s);
    const showOnly = (id) => {
        ["#view-login", "#view-user", "#view-admin"].forEach(sel => {
            const el = qs(sel);
            if (el) el.classList.add("hide");
        });
        const tgt = qs(id);
        if (tgt) tgt.classList.remove("hide");
    };
    const hidden = (sel) => {
        const el = qs(sel);
        return !el || el.classList.contains("hide");
    };

    //helper template
    const tpl = id => document.getElementById(id);
    const cloneTpl = id => tpl(id).content.firstElementChild.cloneNode(true);
    window.dom = { qs, showOnly, hidden, cloneTpl };
    window.$ = (s, r = document) => r.querySelector(s);
    window._txt = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
    window._attr = (sel, n, v) => { const el = $(sel); if (el) el.setAttribute(n, v); };
})();