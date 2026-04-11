(function() {
    'use strict';

    console.log('[Teams Tools] Iniciando v2.0 - E2EE & Central Menu');

    const MENU_ID = 'gemini-teams-tools-menu';
    const E2EE_PREFIX = '🔒[E2EE]:';
    
    // --- ESTILOS ACTUALIZADOS (MENU CENTRAL) ---
    const CSS = `
        #${MENU_ID}-overlay {
            display: none;
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            z-index: 999998;
        }
        #${MENU_ID} {
            display: none;
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 450px;
            max-width: 90vw;
            background-color: #1f1f1f;
            color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.8);
            font-family: 'Segoe UI', system-ui, sans-serif;
            z-index: 999999;
            padding: 24px;
            border: 1px solid #333;
        }
        #${MENU_ID}.active, #${MENU_ID}-overlay.active { display: block; }
        
        .menu-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #333;
            padding-bottom: 15px;
        }
        .menu-header h2 { margin: 0; font-size: 20px; color: #7f56d9; }
        
        .feature-card {
            background: #2d2d2d;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 15px;
            border: 1px solid #3d3d3d;
        }
        .feature-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #aaa; text-transform: uppercase; letter-spacing: 1px; }
        
        /* E2EE UI */
        .e2ee-controls { display: flex; flex-direction: column; gap: 10px; }
        .e2ee-status { display: flex; align-items: center; gap: 10px; }
        .toggle-switch {
            position: relative; display: inline-block; width: 40px; height: 20px;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: #444; transition: .4s; border-radius: 20px;
        }
        input:checked + .slider { background-color: #7f56d9; }
        .slider:before {
            position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px;
            background-color: white; transition: .4s; border-radius: 50%;
        }
        input:checked + .slider:before { transform: translateX(20px); }
        
        .key-input {
            background: #111; border: 1px solid #444; color: #fff;
            padding: 8px; border-radius: 6px; font-family: monospace; font-size: 12px;
        }

        /* Mensajes E2EE en el chat */
        .e2ee-msg-detected {
            background-color: rgba(127, 86, 217, 0.15) !important;
            border-left: 3px solid #7f56d9 !important;
            border-radius: 4px;
            padding: 4px 8px;
            position: relative;
        }
        .e2ee-badge {
            font-size: 10px; color: #7f56d9; font-weight: bold; margin-bottom: 4px; display: block;
        }

        .gif-grid {
            display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
            max-height: 200px; overflow-y: auto; padding-right: 5px;
        }
        .gif-btn {
            background: #333; border: none; border-radius: 6px; cursor: pointer;
            aspect-ratio: 1; display: flex; align-items: center; justify-content: center; overflow: hidden;
        }
        .gif-btn:hover { background: #444; transform: scale(1.05); }
        .gif-btn img { width: 100%; height: 100%; object-fit: cover; }
    `;

    // --- LOGICA DE CIFRADO ---
    const E2EE = {
        enabled: localStorage.getItem('teams-e2ee-enabled') === 'true',
        
        async getKey(password) {
            const enc = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
            );
            return crypto.subtle.deriveKey(
                { name: "PBKDF2", salt: enc.encode("teams-salt"), iterations: 100000, hash: "SHA-256" },
                keyMaterial,
                { name: "AES-GCM", length: 256 },
                false, ["encrypt", "decrypt"]
            );
        },

        async encrypt(text) {
            const pass = localStorage.getItem('teams-e2ee-key') || 'default';
            const key = await this.getKey(pass);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(text);
            const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
            
            // Unir IV + Datos Cifrados en Base64
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            return E2EE_PREFIX + btoa(String.fromCharCode(...combined));
        },

        async decrypt(cipherText) {
            try {
                const pass = localStorage.getItem('teams-e2ee-key') || 'default';
                const key = await this.getKey(pass);
                const data = Uint8Array.from(atob(cipherText.replace(E2EE_PREFIX, '')), c => c.charCodeAt(0));
                const iv = data.slice(0, 12);
                const encrypted = data.slice(12);
                const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
                return new TextDecoder().decode(decrypted);
            } catch (e) {
                return "⚠️ [Error de Decodificación: Clave Incorrecta]";
            }
        }
    };

    // --- MOTOR DE UI ---
    let customEmojis = {};

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    async function handleE2EEMessage(node) {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes(E2EE_PREFIX)) {
            const container = node.parentElement;
            if (container) {
                const decrypted = await E2EE.decrypt(node.nodeValue.trim());
                container.innerHTML = `<span class="e2ee-badge">🔒 CIFRADO DE EXTREMO A EXTREMO</span>${decrypted}`;
                container.closest('[data-tid="message-text"], .ui-chat__message__content, .message-body-container')?.classList.add('e2ee-msg-detected');
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            node.childNodes.forEach(handleE2EEMessage);
        }
    }

    function replaceEmojis(node) {
        if (node.isContentEditable || node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') return;
        if (node.nodeType === Node.TEXT_NODE) {
            const regex = /::logisemoji_(\d+)::/g;
            if (regex.test(node.nodeValue)) {
                const span = document.createElement('span');
                span.innerHTML = node.nodeValue.replace(regex, (match, idx) => {
                    const url = customEmojis[idx];
                    return url ? `<img src="${url}" class="custom-gif-inline" style="max-height:40px; vertical-align:middle;">` : match;
                });
                node.parentNode.replaceChild(span, node);
            }
        } else {
            node.childNodes.forEach(replaceEmojis);
        }
    }

    // Interceptar el envío para cifrar
    function setupEncryptionInterceptor() {
        document.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey && E2EE.enabled) {
                const editor = document.querySelector('[contenteditable="true"]:focus');
                if (editor && editor.innerText.trim() && !editor.innerText.startsWith(E2EE_PREFIX)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    
                    const originalText = editor.innerText;
                    const encrypted = await E2EE.encrypt(originalText);
                    
                    editor.innerText = '';
                    editor.focus();
                    document.execCommand('insertText', false, encrypted);
                    
                    // Disparar evento para que Teams detecte el cambio
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    // Pequeño delay para asegurar que el DOM se actualizó y enviar
                    setTimeout(() => {
                        const sendBtn = document.querySelector('button[data-tid="sendMessageButton"]');
                        if (sendBtn) sendBtn.click();
                        else {
                            // Si no hay botón, forzamos un Enter manual
                            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
                            editor.dispatchEvent(enterEvent);
                        }
                    }, 100);
                }
            }
        }, true);
    }

    async function createMenu() {
        if (document.getElementById(MENU_ID)) return;

        const overlay = document.createElement('div');
        overlay.id = `${MENU_ID}-overlay`;
        overlay.onclick = toggleMenu;
        document.body.appendChild(overlay);

        const menu = document.createElement('div');
        menu.id = MENU_ID;
        menu.innerHTML = `
            <div class="menu-header">
                <h2>Teams Tools Pro</h2>
                <button style="background:none; border:none; color:#666; cursor:pointer; font-size:20px;" onclick="document.getElementById('${MENU_ID}').classList.remove('active'); document.getElementById('${MENU_ID}-overlay').classList.remove('active');">✖</button>
            </div>
            
            <div class="feature-card">
                <h3>🔒 Chat E2EE (Beta)</h3>
                <div class="e2ee-controls">
                    <div class="e2ee-status">
                        <label class="toggle-switch">
                            <input type="checkbox" id="e2ee-toggle" ${E2EE.enabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <span id="e2ee-label">${E2EE.enabled ? 'Activado' : 'Desactivado'}</span>
                    </div>
                    <input type="password" id="e2ee-key" class="key-input" placeholder="Clave compartida del chat..." value="${localStorage.getItem('teams-e2ee-key') || ''}">
                    <p style="font-size:11px; color:#666; margin:0;">La otra persona debe usar la misma clave para leerte.</p>
                </div>
            </div>

            <div class="feature-card">
                <h3>🔥 Mis Animojis</h3>
                <div class="gif-grid" id="menu-gif-grid">
                    <p style="font-size:12px; color:#666;">Cargando...</p>
                </div>
            </div>
            
            <p style="text-align:center; font-size:10px; color:#444;">CTRL + ESPACIO para abrir</p>
        `;
        document.body.appendChild(menu);

        // Eventos del menú
        document.getElementById('e2ee-toggle').onchange = (e) => {
            E2EE.enabled = e.target.checked;
            localStorage.setItem('teams-e2ee-enabled', E2EE.enabled);
            document.getElementById('e2ee-label').textContent = E2EE.enabled ? 'Activado' : 'Desactivado';
        };

        document.getElementById('e2ee-key').oninput = (e) => {
            localStorage.setItem('teams-e2ee-key', e.target.value);
        };

        // Cargar GIFs
        const res = await fetch('https://logise1.github.io/static/emojis.json');
        const data = await res.json();
        const grid = document.getElementById('menu-gif-grid');
        grid.innerHTML = '';
        data.forEach((item, index) => {
            const url = typeof item === 'string' ? item : (item.url || item.link);
            customEmojis[index] = url;
            const btn = document.createElement('button');
            btn.className = 'gif-btn';
            btn.innerHTML = `<img src="${url}">`;
            btn.onclick = () => {
                insertText(`::logisemoji_${index}::`);
                toggleMenu();
            };
            grid.appendChild(btn);
        });
    }

    function insertText(text) {
        const editor = document.querySelector('[contenteditable="true"]:focus') || document.querySelector('[contenteditable="true"]');
        if (editor) {
            editor.focus();
            document.execCommand('insertText', false, text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function toggleMenu() {
        const m = document.getElementById(MENU_ID);
        const o = document.getElementById(`${MENU_ID}-overlay`);
        if (m.classList.contains('active')) {
            m.classList.remove('active');
            o.classList.remove('active');
        } else {
            m.classList.add('active');
            o.classList.add('active');
        }
    }

    // --- INICIALIZACIÓN ---
    window.addEventListener('load', () => {
        injectStyles();
        createMenu();
        setupEncryptionInterceptor();

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    replaceEmojis(node);
                    handleE2EEMessage(node);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
        
        // Atajo de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.code === 'Space') {
                e.preventDefault();
                toggleMenu();
            }
        });
    });

})();
