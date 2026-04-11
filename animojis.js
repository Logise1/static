// Archivo para subir a: https://logise1.github.io/static/animojis.js

(function() {
    'use strict';

    console.log('[Teams Tools] Iniciando script remoto desde GitHub (v1.8)');

    // ID único para nuestro menú
    const MENU_ID = 'gemini-teams-tools-menu';

    // Inyectar estilos CSS para el menú flotante
    GM_addStyle(`
        #${MENU_ID} {
            display: none;
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 320px;
            background-color: #242424;
            color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            z-index: 999999;
            padding: 15px;
            border: 1px solid #3a3a3a;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        
        #${MENU_ID}::-webkit-scrollbar {
            display: none;
        }

        #${MENU_ID}.active { display: block; }
        
        #${MENU_ID} h2 {
            margin-top: 0;
            font-size: 18px;
            border-bottom: 1px solid #444;
            padding-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .close-btn { cursor: pointer; background: none; border: none; color: #aaa; font-size: 16px; }
        .close-btn:hover { color: #fff; }
        .tool-section { margin-top: 5px; }
        .tool-section h3 { font-size: 14px; color: #b3b0ad; margin-bottom: 8px; display: none; }
        
        .gif-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
            max-height: 250px;
            overflow-y: auto;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        
        .gif-grid::-webkit-scrollbar { display: none; }

        .gif-btn {
            background: #333;
            border: 1px solid #444;
            border-radius: 4px;
            cursor: pointer;
            padding: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 50px;
            transition: background 0.2s;
        }
        .gif-btn:hover { background: #555; transform: scale(1.05); }
        .gif-btn img { max-width: 100%; max-height: 100%; object-fit: contain; }
        .custom-gif-inline { max-height: 40px; vertical-align: middle; border-radius: 4px; margin: 0 2px; }
    `);

    let customEmojis = {};
    let emojisLoaded = false;

    function replaceTextWithImages(node) {
        if (node.isContentEditable || node.nodeName === 'INPUT' || node.nodeName === 'TEXTAREA') return;
        if (node.nodeType === Node.ELEMENT_NODE && node.closest && node.closest('[contenteditable="true"]')) return;
        if (node.nodeType === Node.TEXT_NODE && node.parentElement && node.parentElement.closest('[contenteditable="true"]')) return;
        if (node.nodeType === Node.ELEMENT_NODE && node.closest && node.closest(`#${MENU_ID}`)) return;

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.nodeValue;
            const regex = /::logisemoji_(\d+)::/g;
            if (regex.test(text)) {
                const span = document.createElement('span');
                let lastIndex = 0;
                let match;
                regex.lastIndex = 0;
                while ((match = regex.exec(text)) !== null) {
                    const before = text.substring(lastIndex, match.index);
                    if (before) span.appendChild(document.createTextNode(before));
                    
                    const emojiIdx = match[1];
                    const url = customEmojis[emojiIdx];
                    if (url) {
                        const img = document.createElement('img');
                        img.src = url;
                        img.className = 'custom-gif-inline';
                        img.title = 'Custom GIF';
                        span.appendChild(img);
                    } else {
                        span.appendChild(document.createTextNode(match[0]));
                    }
                    lastIndex = regex.lastIndex;
                }
                const after = text.substring(lastIndex);
                if (after) span.appendChild(document.createTextNode(after));
                
                node.parentNode.replaceChild(span, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            Array.from(node.childNodes).forEach(replaceTextWithImages);
        }
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                replaceTextWithImages(node);
            });
        });
    });

    window.addEventListener('load', () => {
        observer.observe(document.body, { childList: true, subtree: true });
        replaceTextWithImages(document.body);
    });

    async function fetchCustomEmojis() {
        if (emojisLoaded) return;
        try {
            console.log('[Teams Tools] Descargando emojis de GitHub...');
            const res = await fetch('https://logise1.github.io/static/emojis.json');
            const data = await res.json();
            data.forEach((item, index) => {
                customEmojis[index] = typeof item === 'string' ? item : (item.url || item.link);
            });
            emojisLoaded = true;
            console.log('[Teams Tools] Emojis cargados:', Object.keys(customEmojis).length);
            replaceTextWithImages(document.body);
        } catch (error) {
            console.error("[Teams Tools] Error cargando los emojis:", error);
        }
    }

    function createToolbarButton() {
        const btn = document.createElement('button');
        btn.className = 'gemini-custom-emoji-btn';
        btn.title = 'Custom Emojis';
        
        const iconImg = document.createElement('img');
        iconImg.src = 'https://logise1.github.io/static/fireicon.svg';
        iconImg.style.width = '20px';
        iconImg.style.height = '20px';
        iconImg.style.pointerEvents = 'none';
        btn.appendChild(iconImg);
        
        btn.style.background = 'transparent';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.padding = '4px 8px';
        btn.style.margin = '0 2px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.transition = 'transform 0.2s';
        btn.style.color = 'inherit'; 
        btn.style.borderRadius = '4px';
        
        btn.addEventListener('mouseover', () => btn.style.background = 'rgba(255, 255, 255, 0.1)');
        btn.addEventListener('mouseout', () => btn.style.background = 'transparent');
        btn.addEventListener('mousedown', (e) => { e.preventDefault(); });

        btn.addEventListener('click', (e) => {
            e.preventDefault(); 
            e.stopPropagation();
            toggleMenu();
        });
        
        return btn;
    }

    function setupInlineButton() {
        setInterval(() => {
            const formatBtns = document.querySelectorAll('button[data-tid="sendMessageCommands-expand-compose"]');
            let injectedAny = false;

            formatBtns.forEach(formatBtn => {
                if (formatBtn.offsetParent !== null) {
                    const targetContainer = formatBtn.parentElement;
                    if (!targetContainer.querySelector('.gemini-custom-emoji-btn')) {
                        targetContainer.insertBefore(createToolbarButton(), formatBtn.nextSibling);
                    }
                    injectedAny = true;
                }
            });

            if (!injectedAny) {
                const editors = document.querySelectorAll('[contenteditable="true"]');
                for (let i = editors.length - 1; i >= 0; i--) {
                    const editor = editors[i];
                    if (editor.offsetParent !== null) {
                        let parent = editor;
                        for (let j = 0; j < 8 && parent; j++) {
                            parent = parent.parentElement;
                            if (parent) {
                                const visibleBtns = Array.from(parent.querySelectorAll('button')).filter(b => b.offsetParent !== null && b.clientHeight > 10);
                                if (visibleBtns.length >= 3) {
                                    const referenceNode = visibleBtns[1] || visibleBtns[visibleBtns.length - 1];
                                    const targetContainer = referenceNode.parentElement;
                                    
                                    if (targetContainer && !targetContainer.querySelector('.gemini-custom-emoji-btn')) {
                                        targetContainer.insertBefore(createToolbarButton(), referenceNode);
                                    }
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }, 2000); 
    }

    function insertEmojiCode(code) {
        const editors = document.querySelectorAll('[contenteditable="true"]');
        if (editors.length === 0) return;

        let editor = null;
        for (let i = editors.length - 1; i >= 0; i--) {
            if (editors[i].offsetParent !== null) {
                editor = editors[i];
                break;
            }
        }

        if (!editor) editor = editors[editors.length - 1];

        if (editor) {
            if (document.activeElement !== editor) {
                editor.focus();
            }
            
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', code);
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            editor.dispatchEvent(pasteEvent);

            document.execCommand('insertText', false, code);

            try {
                const textEvent = document.createEvent('TextEvent');
                textEvent.initTextEvent('textInput', true, true, window, code);
                editor.dispatchEvent(textEvent);
            } catch(e) {}
            
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            editor.dispatchEvent(inputEvent);
        }
    }

    async function createMenu() {
        if (document.getElementById(MENU_ID)) return;
        
        await fetchCustomEmojis();

        const menu = document.createElement('div');
        menu.id = MENU_ID;

        const header = document.createElement('h2');
        const titleSpan = document.createElement('span');
        titleSpan.textContent = '🔥 Emojis';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.id = 'close-teams-tools';
        closeBtn.textContent = '✖';
        closeBtn.addEventListener('click', toggleMenu);

        header.appendChild(titleSpan);
        header.appendChild(closeBtn);
        menu.appendChild(header);

        const section0 = document.createElement('div');
        section0.className = 'tool-section';

        const gifGrid = document.createElement('div');
        gifGrid.className = 'gif-grid';

        if (Object.keys(customEmojis).length > 0) {
            Object.entries(customEmojis).forEach(([idx, url]) => {
                const btn = document.createElement('button');
                btn.className = 'gif-btn';
                btn.title = `Insertar GIF`;
                
                const img = document.createElement('img');
                img.src = url;
                btn.appendChild(img);
                
                btn.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                });

                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const textCode = `::logisemoji_${idx}::`;
                    insertEmojiCode(textCode);
                });
                
                gifGrid.appendChild(btn);
            });
        } else {
            const errorMsg = document.createElement('span');
            errorMsg.textContent = 'Cargando GIFs... vuelve a abrir el menú.';
            errorMsg.style.fontSize = '12px';
            errorMsg.style.color = '#ffaa00';
            gifGrid.appendChild(errorMsg);
        }
        
        section0.appendChild(gifGrid);
        menu.appendChild(section0);

        document.body.appendChild(menu);
    }

    async function toggleMenu() {
        const menu = document.getElementById(MENU_ID);
        if (menu) {
            menu.classList.toggle('active');
        } else {
            await createMenu();
            document.getElementById(MENU_ID).classList.add('active');
        }
    }

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.code === 'Space') {
            event.preventDefault();
            toggleMenu();
        }
    });

    window.addEventListener('load', () => {
        setupInlineButton();
        fetchCustomEmojis();
        createMenu();
    });

})();
