/* ===== Boot / Auth ===== */
(function () {
    const { qs, showOnly } = window.dom;
    const { db, subscribeReported, subscribeLegacyRelays, subscribeRooms, subscribeOnlineStatus } = window.app;

    async function doLogout() {
        try { await window.app.writeAudit({ type: 'auth_logout' }); } catch (_) { }
        try { await firebase.auth().signOut(); } catch (_) { }
    }
    window.app.doLogout = doLogout;

    // tampilkan login saat awal load
    showOnly("#view-login");

    qs("#loginBtn").addEventListener("click", async () => {
        const email = qs("#email").value.trim().toLowerCase();
        const pass = qs("#password").value;
        const errEl = qs("#loginErr");
        errEl.textContent = ""; errEl.classList.remove("show");
        try {
            await firebase.auth().signInWithEmailAndPassword(email, pass);
            // audit login dicatat setelah role terbaca (di onAuthStateChanged)
        } catch (e) {
            errEl.textContent = e.message || "Login gagal.";
            errEl.classList.add("show");
        }
    });

    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) { showOnly("#view-login"); return; }

        // === FIX: path role TANPA spasi + fallback 'user' TANPA kembali ke login
        let role = "user";
        try {
            const snap = await db.ref("users").child(user.uid).child("role").get(); // <— benar
            if (snap.exists()) role = snap.val() || "user";
            // (opsional) seed role default:
            // else await db.ref(`users/${user.uid}`).update({ role: "user" }).catch(()=>{});
        } catch (e) {
            console.warn("Gagal baca role, pakai fallback 'user':", e?.code || e?.message || e);
            // Penting: JANGAN balik ke view-login di sini; lanjut pakai role 'user'.
        }

        window.app.currRole = role;
        window.app.currUid = user.uid;
        window.app.currUserEmail = user.email;

        // subscribe audit agar tab Log auto-nyala
        if (window.app.subscribeAudit) {
            window.app.subscribeAudit(() => {
                if (window.app.a_view === 'log') window.app.renderAdmin();
            });
        }

        // sinkron RTDB
        subscribeReported();
        subscribeLegacyRelays();
        subscribeRooms();
        subscribeOnlineStatus();

        // catat login sekarang (role sudah terisi)
        try { await window.app.writeAudit({ type: 'auth_login' }); } catch (_) { }

        // render sesuai role
        if (role === "admin") window.app.renderAdminBoot(user.email);
        else window.app.renderUserBoot(user.email);
    });
})();