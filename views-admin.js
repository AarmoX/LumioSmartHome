/* ===== ADMIN Views (hapus log lokal; tambah Clear pada audit) ===== */
(function () {
    const { qs, cloneTpl } = window.dom;
    const {
        state, roomsMap, roomMembersKeys, deviceLabel, devicePowerState,
        setRoomPower, deleteRoom, setMember, createRoom, allPower,
        loadSchedules, CHANNELS, pad2
    } = window.app;

    function makeBulbToggle({ on, datasetName, datasetValue, size = "sm" }) {
        const wrap = document.createElement("div"); wrap.className = "toggleShell"; wrap.dataset.on = on ? "true" : "false";
        const label = document.createElement("div"); label.className = "all-label";
        const bulb = document.createElement("span"); bulb.className = "bulb"; bulb.setAttribute("aria-hidden", "true"); bulb.textContent = "💡";
        const strong = document.createElement("strong"); strong.className = "t-caption"; strong.textContent = on ? "ON" : "OFF";
        label.append(bulb, strong);
        const btn = document.createElement("button"); btn.type = "button"; btn.className = "toggle-pill " + size; btn.setAttribute("aria-pressed", on ? "true" : "false"); btn.dataset[datasetName] = datasetValue;
        wrap.append(label, btn); return wrap;
    }

    window.app.a_view = "rooms";

    function a_updateNav() {
        // highlight menu aktif
        document.querySelectorAll("#a-sideNav .side-link")
            .forEach(el => el.classList.toggle("active", el.dataset.view === window.app.a_view));
    
        // update atribut tombol ALL
        const btn = qs("#a-toggleAllBtn");
        if (btn) {
            const allOn = state.lamp1 && state.lamp2 && state.dimP;
            btn.textContent = allOn ? "All OFF" : "All ON";
            btn.dataset.caption = allOn ? "ALL ON" : "ALL OFF";
            btn.setAttribute("aria-pressed", allOn ? "true" : "false");
        }
        syncAllToggleAdmin();
    }

    function renderAdmin() {
        const root = qs("#a-view");

        if (window.app.a_view === "dashboard") {
            const total = 3, on = [state.lamp1, state.lamp2, state.dimP].filter(Boolean).length, dimm = 1;
            root.innerHTML = `
          <h2 class="section-title">Monitoring</h2>
          <div class="list">
            <div class="item"><div>Total Lampu</div><div><strong>${total}</strong></div></div>
            <div class="item"><div>Menyala</div><div><strong>${on}</strong></div></div>
            <div class="item"><div>Lampu dimmer</div><div><strong>${dimm}</strong></div></div>
          </div>`;
        }

        if (window.app.a_view === "rooms") {
            const entries = Object.entries(roomsMap()).sort((a, b) => (a[1]?.name || '').localeCompare(b[1]?.name || ''));
            root.innerHTML = `
          <h2 class="section-title">Rooms (Admin)</h2>
          <div class="card mb-16">
            <div class="flex" style="gap:8px;align-items:center;">
              <input id="roomName" class="input" placeholder="Nama room (mis. Ruang Tamu)" style="flex:1;min-width:200px;">
              <button class="btn primary" id="btnCreateRoom">Buat Room</button>
            </div>
            <div class="hint mt-16">Setelah room dibuat, centang lampu yang ingin dimasukkan ke room tersebut.</div>
          </div>`;

            if (entries.length) {
                entries.forEach(([id, r]) => {
                    const card = cloneTpl("tpl-admin-room");
                    card.dataset.room = id;
                    card.querySelector(".room-name").textContent = r.name || "(Tanpa Nama)";
                    const members = roomMembersKeys(r);
                    card.querySelector(".room-count").textContent = `Lampu: ${members.length}`;

                    const btnOn = card.querySelector('[data-rooms-act="on"]');
                    const btnOff = card.querySelector('[data-rooms-act="off"]');
                    card.querySelector('[data-room-del]').dataset.roomDel = id;

                    const chipsWrap = card.querySelector(".admin-chips");
                    if (members.length) {
                        members.forEach(k => {
                            const on = devicePowerState(k);
                            const span = document.createElement("span");
                            span.className = "badge" + (on ? " blue" : "");
                            span.textContent = `${deviceLabel(k)} ${on ? 'ON' : 'OFF'}`;
                            span.dataset.dev = k;
                            chipsWrap.appendChild(span);
                        });
                    } else {
                        const span = document.createElement("span"); span.className = "hint"; span.textContent = "Belum ada lampu"; chipsWrap.appendChild(span);
                    }
                    const onlineEl = document.createElement("span");
                    onlineEl.className = "badge " + (state.online ? "green" : "red");
                    onlineEl.textContent = state.online ? "Online" : "Offline";
                    chipsWrap.appendChild(onlineEl);

                    Object.keys(CHANNELS).forEach(k => {
                        const label = document.createElement("label"); label.className = "flex"; label.style.gap = "6px";
                        const inp = document.createElement("input"); inp.type = "checkbox"; inp.dataset.roomId = id; inp.dataset.roomMem = k;
                        if (r.members && r.members[k]) inp.checked = true;
                        label.appendChild(inp); label.append(` ${deviceLabel(k)}`);
                        card.querySelector(".admin-members").appendChild(label);
                    });

                    if (btnOn) btnOn.classList.add("hide");
                    if (btnOff) btnOff.classList.add("hide");
                    const allOn = members.length ? members.every(k => devicePowerState(k)) : false;
                    const ctrlWrap = btnOn ? btnOn.parentElement : card.querySelector(".flex:last-child");
                    const tgl = makeBulbToggle({ on: allOn, datasetName: "aRoomtoggle", datasetValue: id });
                    ctrlWrap.insertBefore(tgl, card.querySelector('[data-room-del]'));

                    root.appendChild(card);
                });
            } else {
                const empty = document.createElement("div"); empty.className = "card"; empty.textContent = "Belum ada room. Buat room baru di atas."; root.appendChild(empty);
            }

            const createBtn = qs("#btnCreateRoom");
            if (createBtn) {
                createBtn.onclick = async () => {
                    const name = (qs("#roomName").value || "").trim();
                    if (!name) { alert("Nama room tidak boleh kosong."); return; }
                    try {
                        const id = await createRoom(name);
                        qs("#roomName").value = "";
                        window.app.writeAudit({ type: 'room_create', roomId: id, roomName: name });
                    } catch (err) { console.error(err); alert("Gagal membuat room:\n" + (err?.message || err)); }
                };
            }

            root.onclick = async (e) => {
                const tga = e.target.closest('button.toggle-pill[data-a-roomtoggle]');
                if (tga) {
                    const id = tga.dataset.aRoomtoggle;
                    const rm = roomsMap()[id];
                    const mem = roomMembersKeys(rm);
                    const allOn = mem.length ? mem.every(k => devicePowerState(k)) : false;
                    const next = !allOn;

                    const shell = tga.closest('.toggleShell');
                    window.app.uiFlags.animLockUntil = Date.now() + 420;
                    if (window.app.setToggleShellVisual) { window.app.setToggleShellVisual(shell, next); }
                    else { shell.dataset.on = next ? 'true' : 'false'; const btn = shell.querySelector('.toggle-pill'); const cap = shell.querySelector('.t-caption'); if (btn) btn.setAttribute('aria-pressed', next ? 'true' : 'false'); if (cap) cap.textContent = next ? 'ON' : 'OFF'; }

                    const card = tga.closest('[data-room]'); const chipsWrap = card?.querySelector('.admin-chips');
                    if (chipsWrap) {
                        mem.forEach(k => {
                            const chip = chipsWrap.querySelector(`.badge[data-dev="${k}"]`);
                            if (chip) { chip.textContent = `${deviceLabel(k)} ${next ? 'ON' : 'OFF'}`; chip.classList.toggle('blue', next); if (!next) chip.classList.remove('blue'); }
                        });
                    }

                    try {
                        await setRoomPower(id, next);
                        window.app.writeAudit({ type: 'room_toggle', roomId: id, roomName: rm?.name || "", to: next });
                    } catch (err) { console.error(err); alert("Gagal set power room:\n" + (err?.message || err)); }
                    return;
                }

                const t = e.target;
                if (t.dataset.roomsAct) {
                    try {
                        await setRoomPower(t.dataset.roomId, t.dataset.roomsAct === "on");
                        window.app.writeAudit({ type: 'room_toggle', roomId: t.dataset.roomId, roomName: roomsMap()[t.dataset.roomId]?.name || "", to: t.dataset.roomsAct === "on" });
                    } catch (err) { console.error(err); alert("Gagal set power room:\n" + (err?.message || err)); }
                    return;
                }
                if (t.dataset.roomDel) {
                    if (confirm("Hapus room ini?")) {
                        try {
                            await deleteRoom(t.dataset.roomDel);
                            window.app.writeAudit({ type: 'room_delete', roomId: t.dataset.roomDel });
                        } catch (err) { console.error(err); alert("Gagal hapus room:\n" + (err?.message || err)); }
                    }
                }
            };
            root.onchange = async (e) => {
                const inp = e.target;
                if (inp.matches('input[type="checkbox"][data-room-mem]')) {
                    const roomId = inp.dataset.roomId, key = inp.dataset.roomMem;
                    try {
                        await setMember(roomId, key, inp.checked);
                        window.app.writeAudit({ type: 'room_member_set', roomId, key, checked: !!inp.checked });
                    } catch (err) { console.error(err); alert("Gagal mengubah anggota room:\n" + (err?.message || err)); inp.checked = !inp.checked; }
                }
            };
        }

        if (window.app.a_view === "schedules") {
            root.innerHTML = `
         <div class="grid two-col">
          <div>
            <h2 class="section-title">Schedules</h2>
            <div id="a-schedList" class="list"><div class="item">Memuat...</div></div>
          </div>
          <div>
            <h2 class="section-title">Tambah Jadwal</h2>
            <div class="card">
              <div class="mb-12"><input id="schLabel" class="input" placeholder="Label (opsional)" /></div>
              <div class="mb-12">
                <div class="mb-8">Waktu (24 jam)</div>
                <div class="flex" style="align-items:center;gap:8px;">
                  <input id="schH" class="input" type="number" min="0" max="23" step="1" value="0" style="width:80px;text-align:center;" />
                  <div style="font-weight:700;">:</div>
                  <input id="schM" class="input" type="number" min="0" max="59" step="1" value="0" style="width:80px;text-align:center;" />
                  <span class="badge" id="schHmBadge">00:00</span>
                </div>
                <div id="schTimeErr" class="hint" style="color:#dc3545;"></div>
              </div>
              <div class="mb-12">
                <div class="mb-8">Hari</div>
                <div id="schDayToggles" class="day-toggle-group">
                  <button type="button" class="day-chip" data-day="1" aria-pressed="false">Sen</button>
                  <button type="button" class="day-chip" data-day="2" aria-pressed="false">Sel</button>
                  <button type="button" class="day-chip" data-day="3" aria-pressed="false">Rab</button>
                  <button type="button" class="day-chip" data-day="4" aria-pressed="false">Kam</button>
                  <button type="button" class="day-chip" data-day="5" aria-pressed="false">Jum</button>
                  <button type="button" class="day-chip" data-day="6" aria-pressed="false">Sab</button>
                  <button type="button" class="day-chip" data-day="7" aria-pressed="false">Min</button>
                  <button type="button" class="day-chip" data-day="all" aria-pressed="false" title="Pilih semua hari">Semua</button>
                  <button type="button" class="day-chip clear" id="schDaysClear">Bersihkan</button>
                </div>
                <div class="hint">Klik button sesuai hari yang ingin dipilih.</div>
              </div>
              <div class="mb-12">
                <div class="mb-8">Target</div>
                <select id="schTarget" class="select">
                  <option value="all">All</option>
                  <option value="lamp1">Lampu 1</option>
                  <option value="lamp2">Lampu 2</option>
                  <option value="dimmer">Dimmer</option>
                </select>
              </div>
              <div id="schActionWrap" class="mb-12">
                <div class="mb-8">Aksi</div>
                <select id="schAction" class="select"><option value="on">ON</option><option value="off">OFF</option></select>
              </div>
              <div id="schDimWrap" class="mb-12" style="display:none;">
                <div class="mb-8">Dimmer</div>
                <div class="flex"><label class="flex"><input type="checkbox" id="schDimPower" checked> Power ON</label></div>
                <div class="flex mt-16" style="align-items:center;gap:10px;">
                  <input type="range" id="schDimLevel" class="range" min="0" max="100" value="50">
                  <span class="badge" id="schDimBadge">50%</span>
                </div>
              </div>
              <div class="flex" style="justify-content:flex-end;">
                <button class="btn" id="schResetBtn">⭮ Reset</button>
                <button class="btn primary" id="schAddBtn" disabled>✚ Tambah</button>
              </div>
            </div>
          </div>
        </div>`;

            const targetSel = qs("#schTarget"), actWrap = qs("#schActionWrap"), dimWrap = qs("#schDimWrap");
            const dimSlider = qs("#schDimLevel"), dimBadge = qs("#schDimBadge");
            const schH = qs("#schH"), schM = qs("#schM"), timeErr = qs("#schTimeErr"), addBtn = qs("#schAddBtn");
            const timeBadge = qs("#schHmBadge");

            /* === Chip-based day selection === */
            const dayToggles = qs("#schDayToggles");
            const btnClearDays = qs("#schDaysClear");
            let selectedDays = new Set();

            function clampNumberInput(el) {
                const min = parseInt(el.min, 10), max = parseInt(el.max, 10);
                let v = parseInt(el.value, 10);
                if (Number.isNaN(v)) v = min;
                v = Math.max(min, Math.min(max, v));
                el.value = v;
            }
            function updateTimeValidity() {
                clampNumberInput(schH); clampNumberInput(schM);
                const hh = +schH.value, mm = +schM.value;
                const ok = (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59);
                timeErr.textContent = ok ? "" : "Waktu tidak valid (00–23 : 00–59)";
                return ok;
            }
            function updateTimeBadge() {
                const hh = +schH.value || 0, mm = +schM.value || 0;
                timeBadge.textContent = `${pad2(hh)}:${pad2(mm)}`;
            }
            function updateAddBtn() {
                const ok = updateTimeValidity(); updateTimeBadge();
                addBtn.disabled = !(ok && selectedDays.size > 0);
            }

            function setChipPressed(btn, pressed) {
                btn.setAttribute("aria-pressed", pressed ? "true" : "false");
            }
            function syncAllChip() {
                const allBtn = dayToggles.querySelector('[data-day="all"]');
                const isAll = selectedDays.size === 7;
                if (allBtn) allBtn.setAttribute("aria-pressed", isAll ? "true" : "false");
            }

            dayToggles.addEventListener("click", (e) => {
                const b = e.target.closest(".day-chip"); if (!b) return;
                const v = b.dataset.day;
                if (v === "all") {
                    if (selectedDays.size === 7) {
                        selectedDays.clear();
                        dayToggles.querySelectorAll('.day-chip[data-day]').forEach(btn => {
                            if (btn.dataset.day !== "all") setChipPressed(btn, false);
                        });
                    } else {
                        selectedDays = new Set([1, 2, 3, 4, 5, 6, 7]);
                        dayToggles.querySelectorAll('.day-chip[data-day]').forEach(btn => {
                            if (btn.dataset.day !== "all") setChipPressed(btn, true);
                        });
                    }
                    syncAllChip(); updateAddBtn(); return;
                }
                const d = parseInt(v, 10);
                if (selectedDays.has(d)) { selectedDays.delete(d); setChipPressed(b, false); }
                else { selectedDays.add(d); setChipPressed(b, true); }
                syncAllChip(); updateAddBtn();
            });

            btnClearDays.addEventListener("click", () => {
                selectedDays.clear();
                dayToggles.querySelectorAll('.day-chip[data-day]').forEach(btn => {
                    setChipPressed(btn, false);
                });
                syncAllChip(); updateAddBtn();
            });

            targetSel.onchange = () => {
                const t = targetSel.value;
                actWrap.style.display = (t === "dimmer") ? "none" : "block";
                dimWrap.style.display = (t === "dimmer") ? "block" : "none";
            };
            dimSlider.oninput = () => { dimBadge.textContent = (parseInt(dimSlider.value, 10) || 0) + "%"; };
            ["input", "change", "blur"].forEach(ev => { schH.addEventListener(ev, updateAddBtn); schM.addEventListener(ev, updateAddBtn); });

            qs("#schResetBtn").onclick = () => {
                qs("#schLabel").value = "";
                schH.value = "0"; schM.value = "0";
                selectedDays.clear();
                dayToggles.querySelectorAll('.day-chip[data-day]').forEach(btn => setChipPressed(btn, false));
                syncAllChip(); updateAddBtn();
                targetSel.value = "all"; targetSel.onchange();
                qs("#schAction").value = "on";
                qs("#schDimPower").checked = true;
                dimSlider.value = 50; dimBadge.textContent = "50%";
                updateTimeBadge();
            };

            qs("#schAddBtn").onclick = async () => {
                if (addBtn.disabled) return;
                try {
                    const hh = +schH.value, mm = +schM.value;
                    const time = `${pad2(hh)}:${pad2(mm)}`;
                    const days = [...selectedDays].sort((a, b) => a - b);
                    if (!days.length) { alert("Pilih minimal satu hari"); return; }
                    const daysStr = "[" + days.join(",") + "]";
                    const target = targetSel.value;
                    const payload = { time, days: daysStr, target, enabled: true };
                    if (target === "dimmer") { payload.power = !!qs("#schDimPower").checked; payload.level = parseInt(qs("#schDimLevel").value, 10) || 0; }
                    else { payload.action = qs("#schAction").value; }
                    const id = `sch_${Date.now()}`;
                    await window.app.db.ref(`schedules/${window.app.DEVICE_ID}/${id}`).set(payload);
                    window.app.writeAudit({ type: 'schedule_add', id, time, days: daysStr, target, action: payload.action, power: payload.power, level: payload.level });
                } catch (err) { console.error(err); alert("Gagal menambah jadwal:\n" + (err?.message || err)); }
            };

            targetSel.onchange(); updateTimeBadge(); updateAddBtn();
            requestAnimationFrame(() => { loadSchedules(document.querySelector("#a-schedList"), { canToggle: true, canRun: true, canDelete: true, canEdit: false }); });
        }

        if (window.app.a_view === "log") {
            function fmtAudit(a) {
                const U = (k) => (k || '').toUpperCase();
                if (a.type === 'device_toggle') return `${window.app.deviceLabel(a.device)} ${a.to ? 'ON' : 'OFF'}`;
                if (a.type === 'dimmer_power') return `Dimmer power ${a.to ? 'ON' : 'OFF'}`;
                if (a.type === 'dimmer_level') return `Dimmer level → ${a.level}%`;
                if (a.type === 'all_toggle') return `ALL ${a.to ? 'ON' : 'OFF'}`;
                if (a.type === 'room_toggle') return `Room "${a.roomName || a.roomId}" ${a.to ? 'ON' : 'OFF'}`;
                if (a.type === 'room_create') return `Buat room "${a.roomName}"`;
                if (a.type === 'room_delete') return `Hapus room "${a.roomId}"`;
                if (a.type === 'room_member_set') return `${a.checked ? 'Tambah' : 'Hapus'} anggota "${window.app.deviceLabel(a.key)}" → room "${a.roomId}"`;
                if (a.type === 'schedule_add') return `Tambah jadwal ${a.time} → ${a.target}${a.target === 'dimmer' ? ` power=${a.power ? 'ON' : 'OFF'} level=${a.level}%` : ` ${U(a.action)}`}`;
                if (a.type === 'schedule_toggle') return `Ubah status jadwal ${a.id} → ${a.enabled ? 'Aktif' : 'Nonaktif'}`;
                if (a.type === 'schedule_delete') return `Hapus jadwal ${a.id}`;
                if (a.type === 'schedule_run') return `Jalankan jadwal ${a.id} → ${a.target}${a.target === 'dimmer' ? ` power=${a.power ? 'ON' : 'OFF'} level=${a.level}%` : ` ${U(a.action)}`}`;
                if (a.type === 'auth_login') return `Login`;
                if (a.type === 'auth_logout') return `Logout`;
                return a.type || 'aktivitas';
            }

            const aud = (window.app.auditData || []).slice().reverse();
            const audRows = aud.map(a => {
                const time = a.ts ? new Date(a.ts).toLocaleString() : '-';
                const roleCls = a.actorRole === 'admin' ? 'blue' : 'purple';
                const roleBadge = `<span class="badge ${roleCls}">${(a.actorRole || '?').toUpperCase()}</span>`;
                const who = a.actorEmail || a.actorUid || '';
                const msg = fmtAudit(a);
                return `<div class="item">
            <div class="flex" style="justify-content:space-between; width:100%">
              <div class="flex" style="gap:8px; align-items:center;">
                <div class="nowrap">${time}</div>
                ${roleBadge}
                <div class="hint">${who}</div>
              </div>
              <div>${msg}</div>
            </div>
          </div>`;
            }).join("") || '<div class="item">Belum ada aktivitas.</div>';

            const root = qs("#a-view");
            root.innerHTML = `
          <h2 class="section-title">Activity Log (User & Admin)</h2>
          <div class="flex" style="justify-content:flex-end;margin-bottom:8px;">
            <button class="btn red" id="auditClear">⌫ Clear</button>
          </div>
          <div class="list" id="auditList">${audRows}</div>`;

            qs("#auditClear").onclick = async () => {
                if (!confirm("Hapus semua log aktivitas? Tindakan ini tidak bisa dibatalkan.")) return;
                try {
                    await window.app.db.ref(`audit/${window.app.DEVICE_ID}`).remove();
                } catch (err) {
                    console.error(err);
                    alert("Gagal menghapus log:\n" + (err?.message || err));
                }
            };
        }

        a_updateNav();
    }

    function syncAllToggleAdmin() {
        const allOn = state.lamp1 && state.lamp2 && state.dimP;

        function sync(ids) {
            const wrap = qs(ids.wrap), btn = qs(ids.btn), txt = qs(ids.txt);
            if (!wrap || !btn || !txt) return;
            wrap.dataset.on = allOn ? 'true' : 'false';
            btn.setAttribute('aria-pressed', allOn ? 'true' : 'false');
            txt.textContent = allOn ? 'ALL ON' : 'ALL OFF';
        }

        // Topbar
        sync({ wrap: '#a-all', btn: '#a-toggleAllBtn', txt: '#a-allText' });
        // Versi menu sidebar (mobile)
        sync({ wrap: '#a-allMenu', btn: '#a-toggleAllMenuBtn', txt: '#a-allMenuText' });
    }


    function renderAdminBoot(email) {
        window.dom.showOnly("#view-admin");
        window.app.initTopbarMenu('#view-admin', 'a-menuBtn');

        const handleLogout = () => window.app.doLogout();
        const handleAll = async () => {
            const allOn = state.lamp1 && state.lamp2 && state.dimP;
            await window.app.allPower(!allOn);
            window.app.writeAudit({ type: 'all_toggle', to: !allOn });
            syncAllToggleAdmin();
        };

        // Logout: topbar + menu
        qs("#a-logout").onclick = handleLogout;
        const logoutMenu = qs("#a-logoutMenu");
        if (logoutMenu) logoutMenu.onclick = handleLogout;

        // Navigasi
        qs("#a-sideNav").onclick = e => {
            const v = e.target.dataset.view;
            if (!v) return;
            window.app.a_view = v;
            a_updateNav();
            renderAdmin();
        };

        // ALL ON/OFF: topbar + menu
        const t1 = qs("#a-toggleAllBtn");
        if (t1) t1.onclick = handleAll;
        const t2 = qs("#a-toggleAllMenuBtn");
        if (t2) t2.onclick = handleAll;

        renderAdmin();
        syncAllToggleAdmin();
    }

    window.app.renderAdmin = renderAdmin;
    window.app.renderAdminBoot = renderAdminBoot;
    window.app.a_updateNav = a_updateNav;

})();

