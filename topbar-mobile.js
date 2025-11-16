/* === Responsive helpers: popover menu untuk topbar mobile === */
(function () {
    function initTopbarMenu(sectionId, btnId) {
        const section = document.querySelector(sectionId);
        if (!section || section.dataset.menuInit === '1') return;
        const topbar = section.querySelector('.topbar');
        const btn = section.querySelector('#' + btnId);
        if (!topbar || !btn) return;

        section.dataset.menuInit = '1';

        const close = () => {
            topbar.classList.remove('menu-open');
            btn.setAttribute('aria-expanded', 'false');
        };
        const toggle = (e) => {
            e?.stopPropagation?.();
            const open = topbar.classList.toggle('menu-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        };

        btn.addEventListener('click', toggle);
        document.addEventListener('click', (e) => {
            if (!topbar.classList.contains('menu-open')) return;
            if (!topbar.contains(e.target)) close();
        });
        window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
        window.addEventListener('resize', () => { if (window.innerWidth > 600) close(); });
    }
    window.app = Object.assign(window.app || {}, { initTopbarMenu });
})();