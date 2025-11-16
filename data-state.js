/* ===== Core state & RTDB sync ===== */
(function () {
    const { db, DEVICE_ID } = window.app;
    const { hidden } = window.dom;

    const state = { lamp1: false, lamp2: false, dimP: false, dimL: 0, online: false };

    const CHANNELS = {
        lamp1: { label: "Lampu 1", type: "switch" },
        lamp2: { label: "Lampu 2", type: "switch" },
        dimmer: { label: "Dimmer", type: "dimmer" }
    };
    const RELAY_PATHS = {
        lamp1: "/relay1", lamp2: "/relay2", dimmerPower: "/relay4", dimmerLevel: "/dimmerLevel"
    };

    let roomsMapObj = {};
    let roomsSubscribed = false;
    let _serverOffset = 0;
    let _lastSeen = 0;

    window.app.uiFlags = Object.assign(window.app.uiFlags || {}, { userDimmerDragging: false, animLockUntil: 0 });
    window.addEventListener("pointerup", () => { window.app.uiFlags.userDimmerDragging = false; });

    let _rafTick = null;
    function refreshIfVisible() {
        if (_rafTick) return;
        _rafTick = requestAnimationFrame(() => {
            _rafTick = null;
            const u_on = !hidden("#view-user");
            const a_on = !hidden("#view-admin");
            const animLock = (window.app.uiFlags.animLockUntil || 0) > Date.now();
            if (u_on) {
                if (["dashboard", "rooms"].includes(window.app.u_view)) {
                    if (window.app.uiFlags.userDimmerDragging || animLock) window.app.u_updateNav(); else window.app.renderUser();
                } else { window.app.u_updateNav(); }
            }
            if (a_on) {
                if (["dashboard", "rooms", "schedules", "log"].includes(window.app.a_view)) {
                    if (animLock) window.app.a_updateNav(); else window.app.renderAdmin();
                } else { window.app.a_updateNav(); }
            }
        });
    }

    const dPath = k => `devices/${DEVICE_ID}/shadow/desired/${k}`;
    const rPath = k => `devices/${DEVICE_ID}/shadow/reported/${k}`;

    function subscribeReported() {
        db.ref(rPath("lamp1")).on("value", s => { state.lamp1 = !!s.val(); refreshIfVisible(); });
        db.ref(rPath("lamp2")).on("value", s => { state.lamp2 = !!s.val(); refreshIfVisible(); });
        db.ref(rPath("dimmer/power")).on("value", s => { state.dimP = !!s.val(); refreshIfVisible(); });
        db.ref(rPath("dimmer/level")).on("value", s => { const v = s.val(); if (typeof v === "number") state.dimL = v; refreshIfVisible(); });
    }
    function subscribeLegacyRelays() {
        db.ref(RELAY_PATHS.lamp1).on("value", s => { const v = s.val(); if (typeof v === "boolean") { state.lamp1 = v; refreshIfVisible(); } });
        db.ref(RELAY_PATHS.lamp2).on("value", s => { const v = s.val(); if (typeof v === "boolean") { state.lamp2 = v; refreshIfVisible(); } });
        db.ref(RELAY_PATHS.dimmerPower).on("value", s => { const v = s.val(); if (typeof v === "boolean") { state.dimP = v; refreshIfVisible(); } });
        db.ref(RELAY_PATHS.dimmerLevel).on("value", s => { const v = s.val(); if (typeof v === "number") { state.dimL = v; refreshIfVisible(); } });
    }

    const nowServerMs = () => Date.now() + (_serverOffset || 0);
    function recomputeOnline() {
        const was = state.online;
        const ok = (_lastSeen > 0) && ((nowServerMs() - _lastSeen) <= 15000);
        state.online = !!ok;
        if (state.online !== was) refreshIfVisible();
    }
    function subscribeOnlineStatus() {
        db.ref(".info/serverTimeOffset").on("value", s => { _serverOffset = s.val() || 0; recomputeOnline(); });
        db.ref(`devices/${DEVICE_ID}/lastSeen`).on("value", s => { _lastSeen = s.val() || 0; recomputeOnline(); });
        setInterval(recomputeOnline, 5000);
    }

    function setLamp(k, val) {
        const on = !!val;
        const ops = [db.ref(dPath(k)).set(on)];
        if (k === "lamp1") ops.push(db.ref(RELAY_PATHS.lamp1).set(on));
        if (k === "lamp2") ops.push(db.ref(RELAY_PATHS.lamp2).set(on));
        return Promise.all(ops);
    }
    function toggleLamp(k) {
        const current = (k === "lamp1") ? state.lamp1 : (k === "lamp2") ? state.lamp2 : false;
        return setLamp(k, !current);
    }
    function setDimPower(on) {
        const val = !!on;
        return Promise.all([
            db.ref(dPath("dimmer/power")).set(val),
            db.ref(RELAY_PATHS.dimmerPower).set(val)
        ]);
    }
    function setDimLevel(lv) {
        lv = Math.max(0, Math.min(100, parseInt(lv || 0, 10)));
        return Promise.all([
            db.ref(dPath("dimmer/level")).set(lv),
            db.ref(RELAY_PATHS.dimmerLevel).set(lv)
        ]);
    }
    function allPower(on) {
        const val = !!on;
        return Promise.all([
            db.ref(`devices/${DEVICE_ID}/shadow/desired`).update({ lamp1: val, lamp2: val, "dimmer/power": val }),
            db.ref("/").update({
                [RELAY_PATHS.lamp1.slice(1)]: val,
                [RELAY_PATHS.lamp2.slice(1)]: val,
                [RELAY_PATHS.dimmerPower.slice(1)]: val
            })
        ]);
    }

    function subscribeRooms() {
        if (roomsSubscribed) return;
        roomsSubscribed = true;
        db.ref(`rooms/${DEVICE_ID}`).on("value", snap => {
            roomsMapObj = snap.val() || {};
            refreshIfVisible();
        });
    }
    function roomMembersKeys(room) { return Object.keys(room?.members || {}).filter(k => CHANNELS[k]); }
    async function setRoomPower(roomId, on) {
        const room = roomsMapObj[roomId]; if (!room) return;
        const members = roomMembersKeys(room);
        const ops = members.map(k => {
            if (k === "dimmer") return setDimPower(on);
            if (k === "lamp1" || k === "lamp2") return setLamp(k, on);
            return Promise.resolve();
        });
        await Promise.all(ops);
    }
    async function deleteRoom(roomId) { await db.ref(`rooms/${DEVICE_ID}/${roomId}`).remove(); }
    async function setMember(roomId, key, checked) {
        const ref = db.ref(`rooms/${DEVICE_ID}/${roomId}/members/${key}`);
        if (checked) await ref.set(true); else await ref.remove();
    }
    async function createRoom(name) {
        const id = `room_${Date.now()}`;
        await db.ref(`rooms/${DEVICE_ID}/${id}`).set({ name, members: {} });
        return id;
    }
    function deviceLabel(k) { return CHANNELS[k]?.label || k; }
    function devicePowerState(k) {
        if (k === "lamp1") return !!state.lamp1;
        if (k === "lamp2") return !!state.lamp2;
        if (k === "dimmer") return !!state.dimP;
        return false;
    }

    window.app = Object.assign(window.app, {
        state, CHANNELS, RELAY_PATHS,
        subscribeReported, subscribeLegacyRelays, subscribeRooms, subscribeOnlineStatus,
        setLamp, toggleLamp, setDimPower, setDimLevel, allPower,
        roomsMap: () => roomsMapObj, roomMembersKeys, setRoomPower, deleteRoom, setMember, createRoom,
        deviceLabel, devicePowerState, refreshIfVisible,
        pad2: (n) => String(n).padStart(2, "0")
    });
})();