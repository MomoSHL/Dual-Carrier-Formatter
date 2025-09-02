// ==UserScript==
// @name         Dual Carrier Formatter
// @namespace    ihk-bw-formatter
// @version      4.2
// @description  Zwei separate Carrier-Felder (bw_carrier_betrieb/schule), formatiert & verteilt
// @match        https://apps.ihk-berlin.de/tibrosBB/azubiHeftEditForm.jsp*
// @run-at       document-idle
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // Ziel-Textareas
    const NAMES = {
        betrieb: 'ausbinhalt1', // Betriebliche Tätigkeiten
        schule: 'ausbinhalt3', // Berufsschule (Unterrichtsthemen)
    };

    // Carrier-Felder – werden oben sichtbar injiziert, damit Bitwarden sie sicher erkennt
    const CARRIERS = {
        betrieb: { name: 'bw_carrier_betrieb', label: 'BETRIEB → ausbinhalt1' },
        schule: { name: 'bw_carrier_schule', label: 'SCHULE → ausbinhalt3' }
    };

    // --- Vollständiges Rendern der Seite erzwingen ---
    function forceFullPageRender() {
        // Alle Elemente sichtbar machen für vollständiges Rendering
        const allElements = document.querySelectorAll('*');
        const originalStyles = new Map();

        allElements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                originalStyles.set(el, {
                    display: el.style.display,
                    visibility: el.style.visibility,
                    opacity: el.style.opacity,
                    position: el.style.position,
                    left: el.style.left,
                    top: el.style.top
                });

                // Temporär sichtbar machen (außerhalb des Viewports)
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
                el.style.position = 'absolute';
                el.style.left = '-9999px';
                el.style.top = '-9999px';
            }
        });

        // Kurz warten, dann zurücksetzen
        setTimeout(() => {
            originalStyles.forEach((styles, el) => {
                el.style.display = styles.display;
                el.style.visibility = styles.visibility;
                el.style.opacity = styles.opacity;
                el.style.position = styles.position;
                el.style.left = styles.left;
                el.style.top = styles.top;
            });
        }, 500);
    }


    // Remove IHK Banner + Padding
    document.querySelector('.content').style.paddingTop = '0';
    document.querySelector('.headerbereich').style.display = 'none';

    // --- UI: Carrier-Leiste oben rechts einfügen ---
    function ensureCarrierBar() {
        if (document.getElementById('__bw_carrier_bar__')) return;

        const bar = document.createElement('div');
        bar.id = '__bw_carrier_bar__';

        // Responsive Position oben rechts
        bar.style.position = 'fixed';
        bar.style.top = '10px';
        bar.style.right = '10px';
        bar.style.zIndex = '999999';
        bar.style.background = 'rgba(255,255,255,0.95)';
        bar.style.padding = '8px';
        bar.style.border = '1px solid #ccc';
        bar.style.borderRadius = '6px';
        bar.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
        bar.style.font = '12px system-ui, sans-serif';
        bar.style.display = 'flex';
        bar.style.flexDirection = 'row';
        bar.style.gap = '8px';
        bar.style.maxWidth = 'min(430px, calc(100vw - 40px))';
        bar.style.flexWrap = 'wrap';
        bar.style.right = '20%';

        function makeCarrier({ name, label }) {
            const wrap = document.createElement('div');
            wrap.style.display = 'flex';
            wrap.style.flexDirection = 'column';
            wrap.style.gap = '2px';
            wrap.style.minWidth = '150px';
            wrap.style.flex = '1 1 auto';

            const lab = document.createElement('label');;
            lab.style.color = '#444';
            lab.style.fontSize = '11px';
            lab.style.marginTop = '0px';

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.name = name;
            inp.placeholder = label;
            inp.style.width = '100%';
            inp.style.minWidth = '0';
            inp.style.maxWidth = '200px';
            inp.style.padding = '4px 6px';
            inp.style.border = '1px solid #bbb';
            inp.style.borderRadius = '4px';
            inp.style.boxSizing = 'border-box';
            inp.autocomplete = 'off';

            // Event-Listener für sofortiges Einfügen bei Änderungen
            inp.addEventListener('input', () => {
                setTimeout(() => distributeFromCarriers(), 100);
            });

            inp.addEventListener('paste', () => {
                setTimeout(() => distributeFromCarriers(), 100);
            });

            wrap.appendChild(lab);
            wrap.appendChild(inp);
            return wrap;
        }

        bar.appendChild(makeCarrier(CARRIERS.betrieb));
        bar.appendChild(makeCarrier(CARRIERS.schule));

        // CSS für responsive Design hinzufügen
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 600px) {
                #__bw_carrier_bar__ {
                    flex-direction: column !important;
                    max-width: calc(100vw - 20px) !important;
                    right: 10px !important;
                    left: 10px !important;
                    right: auto !important;
                }
                #__bw_carrier_bar__ > div {
                    min-width: auto !important;
                }
                #__bw_carrier_bar__ input {
                    max-width: none !important;
                }
            }
            @media (max-width: 400px) {
                #__bw_carrier_bar__ {
                    font-size: 11px !important;
                    padding: 6px !important;
                }
                #__bw_carrier_bar__ input {
                    padding: 3px 5px !important;
                    font-size: 11px !important;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(bar);

        // Fokus setzen, damit Bitwarden die Inputs sicher erkennt
        setTimeout(() => {
            const first = bar.querySelector(`input[name="${CARRIERS.betrieb.name}"]`);
            if (first) {
                first.focus();
                // Vollständiges Rendern nach dem Fokus setzen
                forceFullPageRender();
            }
        }, 50);
    }

    // --- E-Mail Auto-Fill ---
    function autoFillEmail() {
        const emailField = document.querySelector('input[name="ausbMail2"]');
        if (emailField && emailField.value !== 'christian.grams@charite.de') {
            emailField.value = 'christian.grams@charite.de';
            emailField.dispatchEvent(new Event('input', { bubbles: true }));
            emailField.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        return false;
    }

    // --- Utilities ---
    const nativeTASetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;

    function setTextAreaValue(el, value) {
        if (!el) return false;
        const next = String(value ?? '');
        if (el.value === next) return false;
        try {
            nativeTASetter.call(el, next); // native setter → kompatibel mit reaktiven Listenern
        } catch (e) {
            el.value = next; // fallback
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    function normalize(value) {
        if (value == null) return '';
        let out = String(value);
        out = out.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        out = out.replace(/\|\|\|/g, '\n');// empfohlener Absatz-Platzhalter
        out = out.replace(/\\n/g, '\n');// wörtliches \n
        // optional: HTML-Breaks
        out = out.replace(/<br\s*\/?>(?![^]*<\/textarea>)/gi, '\n');

        out = out.replace(/\n{3,}/g, '\n\n');// 3+ -> 2
        out = out.replace(/[ \t]+\n/g, '\n');   // trailing spaces vor NL
        return out.trim();
    }

    // Suche Textareas – inkl. gleiche Herkunft iframes
    function findTextAreasByName(name) {
        const found = [];
        // im Hauptdokument
        const main = document.getElementsByName(name);
        for (const el of main) if (el.tagName === 'TEXTAREA') found.push(el);

        // in gleich-origin iframes
        const iframes = document.querySelectorAll('iframe');
        for (const fr of iframes) {
            try {
                const d = fr.contentDocument;
                if (!d) continue;
                const els = d.getElementsByName(name);
                for (const el of els) if (el.tagName === 'TEXTAREA') found.push(el);
            } catch (_) { /* cross-origin – ignorieren */ }
        }
        return found;
    }

    // Trage aus Carriern in Textareas ein - Erlaube mehrfache Ausführung
    function distributeFromCarriers() {
        const inB = document.querySelector(`input[name="${CARRIERS.betrieb.name}"]`);
        const inS = document.querySelector(`input[name="${CARRIERS.schule.name}"]`);

        let changed = false;

        if (inB && inB.value.trim()) {
            const taB = findTextAreasByName(NAMES.betrieb)[0];
            if (taB) {
                const newValue = normalize(inB.value);
                // Immer einfügen, auch wenn der Wert gleich ist (für mehrfache Ausführung)
                try {
                    nativeTASetter.call(taB, newValue);
                } catch (e) {
                    taB.value = newValue;
                }
                taB.dispatchEvent(new Event('input', { bubbles: true }));
                taB.dispatchEvent(new Event('change', { bubbles: true }));
                changed = true;
            }
        }

        if (inS && inS.value.trim()) {
            const taS = findTextAreasByName(NAMES.schule)[0];
            if (taS) {
                const newValue = normalize(inS.value);
                // Immer einfügen, auch wenn der Wert gleich ist (für mehrfache Ausführung)
                try {
                    nativeTASetter.call(taS, newValue);
                } catch (e) {
                    taS.value = newValue;
                }
                taS.dispatchEvent(new Event('input', { bubbles: true }));
                taS.dispatchEvent(new Event('change', { bubbles: true }));
                changed = true;
            }
        }

        return changed;
    }

    // Warte auf vollständiges Laden der Website und DOM-Änderungen
    function waitForTargetsAndDistribute(timeoutMs = 45000) {
        const start = Date.now();

        const tryOnce = () => {
            const did = distributeFromCarriers();
            const emailFilled = autoFillEmail(); // E-Mail automatisch ausfüllen
            if (did || emailFilled) return true;
            if (Date.now() - start > timeoutMs) return true; // Timeout
            return false;
        };

        // Warte auf vollständiges Laden der Website
        const ensureFullyLoaded = () => {
            return new Promise((resolve) => {
                if (document.readyState === 'complete') {
                    // Zusätzliche Wartezeit für dynamische Inhalte
                    setTimeout(resolve, 1000);
                } else {
                    window.addEventListener('load', () => {
                        setTimeout(resolve, 1000);
                    });
                }
            });
        };

        ensureFullyLoaded().then(() => {
            // Mehrere Versuche nach vollständigem Laden
            setTimeout(() => tryOnce(), 100);
            setTimeout(() => tryOnce(), 500);
            setTimeout(() => tryOnce(), 1000);
            setTimeout(() => tryOnce(), 2000);
            setTimeout(() => tryOnce(), 4000);
            setTimeout(() => tryOnce(), 8000);
            
            // Zusätzliche E-Mail Auto-Fill Versuche
            setTimeout(() => autoFillEmail(), 1500);
            setTimeout(() => autoFillEmail(), 3000);
            setTimeout(() => autoFillEmail(), 6000);

            if (tryOnce()) return; // sofort geschafft oder Timeout

            const mo = new MutationObserver(() => {
                if (tryOnce()) mo.disconnect();
            });
            mo.observe(document.documentElement, { subtree: true, childList: true });
        });
    }

    // --- Start ---
    function start() {
        // Vollständiges Rendern sofort erzwingen
        forceFullPageRender();

        // Warte auf vollständiges Laden der Website
        const initializeWhenReady = () => {
            if (document.readyState === 'complete') {
                setTimeout(() => {
                    ensureCarrierBar();
                    forceFullPageRender(); // Nochmals rendern nach Carrier-Bar
                    waitForTargetsAndDistribute(45000);
                }, 500);
            } else {
                window.addEventListener('load', () => {
                    setTimeout(() => {
                        ensureCarrierBar();
                        forceFullPageRender(); // Nochmals rendern nach Carrier-Bar
                        waitForTargetsAndDistribute(45000);
                    }, 500);
                });
            }
        };

        initializeWhenReady();

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Vollständiges Rendern beim Sichtbarwerden
                forceFullPageRender();
                setTimeout(() => {
                    distributeFromCarriers();
                    autoFillEmail(); // E-Mail automatisch ausfüllen
                }, 200);
                setTimeout(() => {
                    distributeFromCarriers();
                    autoFillEmail(); // E-Mail automatisch ausfüllen
                }, 1000);
            }
        });

        // Globaler Event-Listener für Bitwarden-Autofill
        document.addEventListener('input', (e) => {
            if (e.target && e.target.name &&
                (e.target.name === CARRIERS.betrieb.name || e.target.name === CARRIERS.schule.name)) {
                setTimeout(() => distributeFromCarriers(), 100);
            }
        });
    }

    start();
})();
