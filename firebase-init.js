/* ===== Firebase init ===== */
(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyATsQWfMzeDSCW6GVB1y0uwHCgBgyjMtTA",
        authDomain: "esp32-relay-control-01-793ca.firebaseapp.com",
        projectId: "esp32-relay-control-01-793ca",
        storageBucket: "esp32-relay-control-01-793ca.firebasestorage.app",
        messagingSenderId: "579248370296",
        appId: "1:579248370296:web:fffb7b5185b8747bce738d",
        databaseURL: "https://esp32-relay-control-01-793ca-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    const DEVICE_ID = "ESP32-Relay-Control-01";
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);

    window.app = window.app || {};
    window.app.db = db;
    window.app.DEVICE_ID = DEVICE_ID;
})();