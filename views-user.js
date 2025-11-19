/* ===== USER Views ===== */
/* ===== Global toggle visual helper ===== */
(function () {
    window.app.setToggleShellVisual = function (shell, on) {
        if (!shell) return;
        shell.dataset.on = on ? 'true' : 'false';
        const btn = shell.querySelector('button.toggle-pill'); if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        const cap = shell.querySelector('.t-caption'); if (cap) cap.textContent = on ? 'ON' : 'OFF';
    };
})();

/* ===== USER main Views ===== */
(function () {
    const { qs, cloneTpl } = window.dom;
    const {
        state, roomsMap, roomMembersKeys, deviceLabel, devicePowerState,
        setRoomPower, setDimLevel, setDimPower, toggleLamp, loadSchedules
    } = window.app;

    function makeBulbToggle({ on, datasetName, datasetValue, size = "sm" }) {
        const wrap = document.createElement("div");
        wrap.className = "toggleShell"; wrap.dataset.on = on ? "true" : "false";
        const label = document.createElement("div"); label.className = "all-label";
        const bulb = document.createElement("span"); bulb.className = "bulb"; bulb.setAttribute("aria-hidden", "true"); bulb.textContent = "💡";
        const strong = document.createElement("strong"); strong.className = "t-caption"; strong.textContent = on ? "ON" : "OFF";
        label.append(bulb, strong);
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "toggle-pill " + size; btn.setAttribute("aria-pressed", on ? "true" : "false"); btn.dataset[datasetName] = datasetValue;
        wrap.append(label, btn);
        return wrap;
    }

    window.app.u_view = "dashboard";

    function u_updateNav() {
    // highlight menu aktif
    document.querySelectorAll("#u-sideNav .side-link")
        .forEach(el => el.classList.toggle("active", el.dataset.view === window.app.u_view));

    // tetap update atribut tombol (aksesibilitas)
    const btn = qs("#u-toggleAllBtn");
    if (btn) {
        const allOn = state.lamp1 && state.lamp2 && state.dimP;
        btn.textContent = allOn ? "All OFF" : "All ON";
        btn.dataset.caption = allOn ? "ALL ON" : "ALL OFF";
        btn.setAttribute("aria-pressed", allOn ? "true" : "false");
    }
    syncAllToggleUser();
}

    function renderUser() {
        const root = qs("#u-view");
        root.onclick = root.oninput = root.onchange = root.onpointerdown = null;

        if (window.app.u_view === "dashboard") {
            root.innerHTML = `<h2 class="section-title">Dashboard</h2>`;
            const list = document.createElement("div"); list.className = "list"; root.appendChild(list);

            const devices = [
                { key: "lamp1", name: "Lampu 1", power: state.lamp1, dimmable: false },
                { key: "lamp2", name: "Lampu 2", power: state.lamp2, dimmable: false },
                { key: "dimmer", name: "Dimmer", power: state.dimP, dimmable: true, level: state.dimL }
            ];

            devices.forEach(d => {
                const row = cloneTpl("tpl-lamp-row");
                row.dataset.dev = d.key;
                row.querySelector(".dev-name").textContent = d.name;

                const pwr = row.querySelector('[data-role="pwr"]');
                pwr.textContent = d.power ? "ON" : "OFF";
                pwr.classList.toggle("blue", d.power);

                const onlineEl = row.querySelector(".device-online");
                onlineEl.textContent = state.online ? "Online" : "Offline";
                onlineEl.classList.toggle("green", state.online);
                onlineEl.classList.toggle("red", !state.online);

                const dimWrap = row.querySelector(".dimmer-wrap");
                const nonDim = row.querySelector(".non-dimmer");
                const levelBadge = row.querySelector('[data-role="level-l"]');
                const slider = dimWrap.querySelector('input[type="range"]');

                if (d.dimmable) {
                    const v = d.level || 0;
                    levelBadge.style.display = "";
                    levelBadge.textContent = v + "%";
                    slider.value = v;
                    dimWrap.style.display = "";
                    nonDim.style.display = "none";
                } else {
                    dimWrap.style.display = "none";
                    nonDim.style.display = "";
                    levelBadge.style.display = "none";
                }

                const oldBtn = row.querySelector('[data-u-act="toggle"]');
                if (oldBtn) oldBtn.classList.add("hide");

                const tgl = makeBulbToggle({ on: d.power, datasetName: "uToggle", datasetValue: d.key });
                row.querySelector(".lamp-col:last-child").appendChild(tgl);

                list.appendChild(row);
            });


            root.onclick = async (e) => {
                const tb = e.target.closest('button.toggle-pill[data-u-toggle]');
                if (tb) {
                    const dev = tb.dataset.uToggle;
                    const prev = (dev === "lamp1") ? state.lamp1 : (dev === "lamp2") ? state.lamp2 : state.dimP;
                    const next = !prev;

                    const shell = tb.closest('.toggleShell');
                    window.app.uiFlags.animLockUntil = Date.now() + 420;
                    window.app.setToggleShellVisual(shell, next);

                    const row = tb.closest('.lamp-row'); const badge = row?.querySelector('[data-role="pwr"]');
                    if (badge) { badge.textContent = next ? 'ON' : 'OFF'; badge.classList.toggle('blue', next); if (!next) badge.classList.remove('blue'); }

                    try {
                        if (dev === "lamp1" || dev === "lamp2") await toggleLamp(dev);
                        else if (dev === "dimmer") await setDimPower(next);
                        window.app.writeAudit({ type: (dev === 'dimmer' ? 'dimmer_power' : 'device_toggle'), device: dev, to: next });
                    } catch (err) { console.error(err); alert("Gagal mengubah status:\n" + (err?.message || err)); }
                    return;
                }
                const t = e.target;
                if (t.dataset.uAct === "toggle") {
                    const wrap = t.closest(".lamp-row"); const dev = wrap?.dataset.dev;
                    try {
                        if (dev === "lamp1" || dev === "lamp2") await toggleLamp(dev);
                        else if (dev === "dimmer") await setDimPower(!state.dimP);
                        window.app.writeAudit({ type: 'device_toggle', device: dev, to: (dev === 'dimmer' ? !state.dimP : undefined) });
                    } catch (err) { console.error(err); alert("Gagal mengubah status:\n" + (err?.message || err)); }
                }
            };

            let dimCommitTimer = null; let dimPendingVal = null; const DIM_DEBOUNCE = 120;
            root.onpointerdown = (e) => { if (e.target.matches('input[type="range"][data-u-dim="level"]')) window.app.uiFlags.userDimmerDragging = true; };
            root.oninput = (e) => {
                const t = e.target;
                if (t.matches('input[type="range"][data-u-dim="level"]')) {
                    const v = parseInt(t.value, 10) || 0;
                    const wrap = t.closest(".lamp-row");
                    const l = wrap.querySelector('[data-role="level-l"]');
                    if (l) {
                        l.style.display = "";
                        l.textContent = v + "%";
                    }
                    dimPendingVal = v;
                    if (dimCommitTimer) clearTimeout(dimCommitTimer);
                    dimCommitTimer = setTimeout(() => {
                        const vv = dimPendingVal; dimPendingVal = null;
                        setDimLevel(vv).catch(() => { });
                    }, DIM_DEBOUNCE);
                }
            };

            root.onchange = (e) => {
                const t = e.target;
                if (t.matches('input[type="range"][data-u-dim="level"]')) {
                    const v = parseInt(t.value, 10) || 0;
                    if (dimCommitTimer) { clearTimeout(dimCommitTimer); dimCommitTimer = null; }
                    setDimLevel(v).then(() => { window.app.writeAudit({ type: 'dimmer_level', level: v }); }).catch(() => { });
                    window.app.uiFlags.userDimmerDragging = false;
                }
            };
        }

        if (window.app.u_view === "rooms") {
            const entries = Object.entries(roomsMap()).sort((a, b) => (a[1]?.name || '').localeCompare(b[1]?.name || ''));
            root.innerHTML = `<h2 class="section-title">Rooms</h2>`;
            if (!entries.length) {
                root.innerHTML += '<div class="card">Belum ada room. (Hubungi admin)</div>';
            } else {
                entries.forEach(([id, r]) => {
                    const card = cloneTpl("tpl-user-room");
                    card.dataset.room = id;
                    card.querySelector(".room-name").textContent = r.name || "(Tanpa Nama)";
                    const members = roomMembersKeys(r);
                    card.querySelector(".room-count").textContent = `Lampu: ${members.length}`;

                    const chipsWrap = card.querySelector(".room-chips");
                    const onlineEl = chipsWrap.querySelector(".device-online");

                    if (members.length) {
                        members.forEach(k => {
                            const on = devicePowerState(k);
                            const span = document.createElement("span");
                            span.className = "badge" + (on ? " blue" : "");
                            span.textContent = `${deviceLabel(k)} ${on ? 'ON' : 'OFF'}`;
                            span.dataset.dev = k;
                            chipsWrap.insertBefore(span, onlineEl);
                        });
                    } else {
                        const span = document.createElement("span"); span.className = "hint"; span.textContent = "Belum ada lampu";
                        chipsWrap.insertBefore(span, onlineEl);
                    }

                    onlineEl.textContent = state.online ? "Online" : "Offline";
                    onlineEl.classList.toggle("green", state.online);
                    onlineEl.classList.toggle("red", !state.online);

                    const btnOn = card.querySelector('[data-u-roomact="on"]');
                    const btnOff = card.querySelector('[data-u-roomact="off"]');
                    if (btnOn) btnOn.classList.add("hide");
                    if (btnOff) btnOff.classList.add("hide");

                    const allOn = members.length ? members.every(k => devicePowerState(k)) : false;
                    const ctrlWrap = btnOn ? btnOn.parentElement : card.querySelector(".flex:last-child");
                    const tgl = makeBulbToggle({ on: allOn, datasetName: "uRoomtoggle", datasetValue: id });
                    ctrlWrap.appendChild(tgl);

                    root.appendChild(card);
                });
            }

            root.onclick = async (e) => {
                const tb = e.target.closest('button.toggle-pill[data-u-roomtoggle]');
                if (!tb) return;
                const roomId = tb.dataset.uRoomtoggle;
                const rm = roomsMap()[roomId];
                const mem = roomMembersKeys(rm);
                const allOn = mem.length ? mem.every(k => devicePowerState(k)) : false;
                const next = !allOn;

                const shell = tb.closest('.toggleShell');
                window.app.uiFlags.animLockUntil = Date.now() + 420;
                window.app.setToggleShellVisual(shell, next);

                const card = tb.closest('[data-room]');
                const chipsWrap = card?.querySelector('.room-chips');
                if (chipsWrap) {
                    mem.forEach(k => {
                        const chip = chipsWrap.querySelector(`.badge[data-dev="${k}"]`);
                        if (chip) { chip.textContent = `${deviceLabel(k)} ${next ? 'ON' : 'OFF'}`; chip.classList.toggle('blue', next); if (!next) chip.classList.remove('blue'); }
                    });
                }

                try {
                    await setRoomPower(roomId, next);
                    window.app.writeAudit({ type: 'room_toggle', roomId, roomName: rm?.name || "", to: next });
                } catch (err) { console.error(err); alert("Gagal set room power:\n" + (err?.message || err)); }
            };
        }

        if (window.app.u_view === "schedules") {
            root.innerHTML = `<h2 class="section-title">Schedules</h2><div id="u-schedList" class="list"><div class="item">Memuat...</div></div>`;
            requestAnimationFrame(() => { loadSchedules(document.querySelector("#u-schedList"), { canToggle: true, canRun: false, canDelete: false, canEdit: false }); });
        }

        u_updateNav();
    }

    function syncAllToggleUser() {
        const allOn = state.lamp1 && state.lamp2 && state.dimP;

        function sync(ids) {
            const wrap = qs(ids.wrap), btn = qs(ids.btn), txt = qs(ids.txt);
            if (!wrap || !btn || !txt) return;
            wrap.dataset.on = allOn ? 'true' : 'false';
            btn.setAttribute('aria-pressed', allOn ? 'true' : 'false');
            txt.textContent = allOn ? 'ALL ON' : 'ALL OFF';
        }

        // Topbar
        sync({ wrap: '#u-all', btn: '#u-toggleAllBtn', txt: '#u-allText' });
        // Versi dalam menu sidebar (mobile)
        sync({ wrap: '#u-allMenu', btn: '#u-toggleAllMenuBtn', txt: '#u-allMenuText' });
    }


    function renderUserBoot(email) {
        window.dom.showOnly("#view-user");
        window.app.initTopbarMenu('#view-user', 'u-menuBtn');

        const handleLogout = () => window.app.doLogout();
        const handleAll = async () => {
            const allOn = state.lamp1 && state.lamp2 && state.dimP;
            await window.app.allPower(!allOn);
            window.app.writeAudit({ type: 'all_toggle', to: !allOn });
            syncAllToggleUser();
        };

        // Logout: topbar + versi di menu
        qs("#u-logout").onclick = handleLogout;
        const logoutMenu = qs("#u-logoutMenu");
        if (logoutMenu) logoutMenu.onclick = handleLogout;

        // Navigasi halaman
        qs("#u-sideNav").onclick = e => {
            const v = e.target.dataset.view;
            if (!v) return;
            window.app.u_view = v;
            u_updateNav();
            renderUser();
        };

        // ALL ON/OFF: topbar + versi di menu
        const t1 = qs("#u-toggleAllBtn");
        if (t1) t1.onclick = handleAll;
        const t2 = qs("#u-toggleAllMenuBtn");
        if (t2) t2.onclick = handleAll;

        u_updateNav();
        renderUser();
        syncAllToggleUser();
    }


    window.app.renderUser = renderUser;
    window.app.renderUserBoot = renderUserBoot;
    window.app.u_updateNav = u_updateNav;

})();
