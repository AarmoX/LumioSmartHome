/* ===== Schedules (dipertahankan) ===== */
(function () {
    const { db, DEVICE_ID, allPower, setLamp, setDimLevel, setDimPower } = window.app;

    function loadSchedules(container, opts) {
        const ref = db.ref(`schedules/${DEVICE_ID}`);
        ref.off(); container.innerHTML = "";
        let initialized = false, hasAny = false;
        const rowId = id => `sch-${id}`;
        const rowHTML = (id, v) => {
            const badge = v.enabled !== false ? '<span class="badge green">Aktif</span>' : '<span class="badge gray">Nonaktif</span>';
            const desc = (v.target === "dimmer")
                ? `Dimmer • power=${v.power ? 'ON' : 'OFF'} • level=${v.level ?? 0}%`
                : `${(v.target || '-').toUpperCase()} ${(v.action || '-').toUpperCase()}`;
            return `
        <div class="item" id="${rowId(id)}" data-id="${id}">
          <div class="flex" style="min-width:0;">
            <div class="nowrap">${v.time || "--"}</div>
            <div>→ ${desc} days ${String(v.days || "[]")}</div>
          </div>
          <div class="flex">
            ${badge}
            ${opts.canRun ? `<button class="btn" data-sch="run">Run</button>` : ""}
            ${opts.canToggle ? `<button class="btn schedule" data-sch="toggle">${v.enabled !== false ? '❌ Nonaktifkan' : '✔️ Aktifkan'}</button>` : ""}
            ${opts.canDelete ? `<button class="btn red" data-sch="del">🗑️ Hapus</button>` : ""}
          </div>
        </div>`;
        };

        ref.once("value", snap => { initialized = true; if (!snap.exists()) container.innerHTML = '<div class="item">Belum ada jadwal.</div>'; });
        ref.on("child_added", snap => {
            const v = snap.val() || {};
            if (initialized && !hasAny) container.innerHTML = "";
            hasAny = true;
            const wrap = document.createElement("div"); wrap.innerHTML = rowHTML(snap.key, v);
            container.appendChild(wrap.firstElementChild);
        });
        ref.on("child_changed", snap => {
            const el = document.getElementById(rowId(snap.key)); if (!el) return;
            const wrap = document.createElement("div"); wrap.innerHTML = rowHTML(snap.key, snap.val() || {});
            el.replaceWith(wrap.firstElementChild);
        });
        ref.on("child_removed", snap => {
            const el = document.getElementById(rowId(snap.key)); if (el) el.remove();
            if (!container.children.length) container.innerHTML = '<div class="item">Belum ada jadwal.</div>';
        });

        container.onclick = async (e) => {
            const btn = e.target.closest("button[data-sch]"); if (!btn) return;
            const row = btn.closest(".item"); const id = row.dataset.id;
            try {
                const val = (await db.ref(`schedules/${DEVICE_ID}/${id}`).get()).val() || {};
                if (btn.dataset.sch === "toggle") {
                    const newVal = !(val.enabled !== false);
                    await db.ref(`schedules/${DEVICE_ID}/${id}/enabled`).set(newVal);
                    window.app.writeAudit({ type: 'schedule_toggle', id, enabled: newVal });
                    return;
                }
                if (btn.dataset.sch === "del") {
                    if (confirm("Hapus jadwal ini?")) {
                        await db.ref(`schedules/${DEVICE_ID}/${id}`).remove();
                        window.app.writeAudit({ type: 'schedule_delete', id });
                    }
                    return;
                }
                if (btn.dataset.sch === "run") {
                    if (val.target === "all") await allPower(val.action === "on");
                    else if (val.target === "lamp1" || val.target === "lamp2") await setLamp(val.target, val.action === "on");
                    else if (val.target === "dimmer") { if (typeof val.level === "number") await setDimLevel(val.level); await setDimPower(val.power !== false); }
                    window.app.writeAudit({ type: 'schedule_run', id, target: val.target, action: val.action, power: val.power, level: val.level });
                }
            } catch (err) { console.error(err); alert("Gagal mengeksekusi aksi jadwal:\n" + (err?.message || err)); }
        };
    }

    window.app.loadSchedules = loadSchedules;
})();