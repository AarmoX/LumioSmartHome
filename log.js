/* ===== AUDIT (User & Admin activity → RTDB)  — realtime multi-log ===== */
(function () {
    const { db, DEVICE_ID } = window.app;
    const AUDIT_LIMIT_DEFAULT = 500;

    function writeAudit(evt) {
        try {
            const u = firebase.auth().currentUser;
            const payload = Object.assign({
                ts: firebase.database.ServerValue.TIMESTAMP,
                actorUid: u?.uid || null,
                actorEmail: u?.email || null,
                actorRole: window.app.currRole || null
            }, evt || {});
            return db.ref(`audit/${DEVICE_ID}`).push(payload);
        } catch (e) {
            return Promise.resolve();
        }
    }

    let _auditArr = [];
    let _auditMap = Object.create(null);
    let _ref = null;
    let _handlers = [];

    function _emit() {
        _auditArr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        _handlers.forEach(fn => { try { fn(_auditArr); } catch (_) { } });
    }

    /** Subscribe with stable, incremental events. Returns unsubscribe fn. */
    function subscribeAudit(cb, limit = AUDIT_LIMIT_DEFAULT) {
        if (_ref) _ref.off();
        _auditArr = [];
        _auditMap = Object.create(null);
        _handlers = [];
        if (typeof cb === 'function') _handlers.push(cb);

        _ref = db.ref(`audit/${DEVICE_ID}`).orderByKey().limitToLast(limit);

        _ref.on('child_added', snap => {
            const v = { id: snap.key, ...(snap.val() || {}) };
            if (!_auditMap[snap.key]) {
                _auditMap[snap.key] = v;
                _auditArr.push(v);
                _emit();
            }
        });
        _ref.on('child_changed', snap => {
            const v = { id: snap.key, ...(snap.val() || {}) };
            _auditMap[snap.key] = v;
            const idx = _auditArr.findIndex(x => x.id === snap.key);
            if (idx > -1) _auditArr[idx] = v; else _auditArr.push(v);
            _emit();
        });
        _ref.on('child_removed', snap => {
            delete _auditMap[snap.key];
            _auditArr = _auditArr.filter(x => x.id !== snap.key);
            _emit();
        });

        return () => { if (_ref) { _ref.off(); _ref = null; } _handlers = []; };
    }

    window.app.writeAudit = writeAudit;
    window.app.subscribeAudit = subscribeAudit;
    Object.defineProperty(window.app, 'auditData', { get() { return _auditArr; } });
})();