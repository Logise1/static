(function (Scratch) {
    'use strict';
    if (!Scratch.extensions.unsandboxed) throw new Error("This extension must run unsandboxed");

    const API_BASE = "https://pangai.arielcapdevila.com";

    class PangAI {
        constructor() {
            this.histories = {};
            this.apiKey = '';
            this.model = 'meta-llama/Llama-3.1-8B-Instruct';
            this.imageModel = 'black-forest-labs/FLUX.1-schnell';
            this.nextImage = null;
        }

        _authHeaders(json) {
            const h = {};
            if (json) h['Content-Type'] = 'application/json';
            if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
            return h;
        }

        getInfo() {
            return {
                id: 'pangai',
                name: 'PangAI',
                color1: '#5588ff',
                menuIconURI: '',
                blocks: [
                    { blockType: Scratch.BlockType.LABEL, text: 'Configuration' },
                    {
                        opcode: 'set_api_key',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'Set API Key to [KEY]',
                        arguments: { KEY: { type: Scratch.ArgumentType.STRING } }
                    },
                    {
                        opcode: 'set_model',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'Set model to [MODEL]',
                        arguments: {
                            MODEL: {
                                type: Scratch.ArgumentType.STRING,
                                menu: 'modelMenu',
                                defaultValue: 'meta-llama/Llama-3.1-8B-Instruct'
                            }
                        }
                    },
                    {
                        opcode: 'get_current_model',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'current model'
                    },
                    { blockType: Scratch.BlockType.LABEL, text: 'pangai.arielcapdevila.com' },
                    { blockType: Scratch.BlockType.LABEL, text: 'Message Management' },
                    { opcode: 'get_prompt', blockType: Scratch.BlockType.REPORTER, text: 'Get prompt [TYPE]', arguments: { TYPE: { type: Scratch.ArgumentType.STRING, menu: 'promptMenu' } } },
                    { opcode: 'generate_text_nocontext', blockType: Scratch.BlockType.REPORTER, text: 'Generate from text (No Context): [PROMPT]', arguments: { PROMPT: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'send_text_to_chat', blockType: Scratch.BlockType.REPORTER, text: 'Send text [PROMPT] to [chatID]', arguments: { PROMPT: { type: Scratch.ArgumentType.STRING }, chatID: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'attach_image', blockType: Scratch.BlockType.COMMAND, text: 'Attach Image [URL] to next message', arguments: { URL: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'inform_chat', blockType: Scratch.BlockType.COMMAND, text: 'Inform [chatID] that [inform]', arguments: { chatID: { type: Scratch.ArgumentType.STRING }, inform: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'generate_image', blockType: Scratch.BlockType.REPORTER, text: 'Generate Image [PROMPT]', arguments: { PROMPT: { type: Scratch.ArgumentType.STRING } } },
                    { blockType: Scratch.BlockType.LABEL, text: 'Chatbot Management' },
                    { opcode: 'create_chatbot', blockType: Scratch.BlockType.COMMAND, text: 'Create chatbot named [chatID]', arguments: { chatID: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'delete_chatbot', blockType: Scratch.BlockType.COMMAND, text: 'Delete chatbot [chatID]', arguments: { chatID: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'reset_chat', blockType: Scratch.BlockType.COMMAND, text: 'Reset chat history of [chatID]', arguments: { chatID: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'get_chat_history', blockType: Scratch.BlockType.REPORTER, text: 'Chat history of [chatID] as Array', arguments: { chatID: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'import_history', blockType: Scratch.BlockType.COMMAND, text: 'Import chat history from [json] as [chatID]', arguments: { json: { type: Scratch.ArgumentType.STRING }, chatID: { type: Scratch.ArgumentType.STRING } } },
                    { opcode: 'import_chats_merge', blockType: Scratch.BlockType.COMMAND, text: 'Import chats from [json] and [merge]', arguments: { json: { type: Scratch.ArgumentType.STRING }, merge: { type: Scratch.ArgumentType.STRING, menu: 'mergeTypes' } } },
                    { opcode: 'all_chats', blockType: Scratch.BlockType.REPORTER, text: 'All chats as Arrays' },
                    { opcode: 'active_chats', blockType: Scratch.BlockType.REPORTER, text: 'Currently Active chats' }
                ],
                menus: {
                    modelMenu: [
                        { text: 'Llama 3.1 8B Instruct', value: 'meta-llama/Llama-3.1-8B-Instruct' },
                        { text: 'Llama 3.1 70B Instruct', value: 'meta-llama/Llama-3.1-70B-Instruct' },
                        { text: 'Llama 3 8B Instruct', value: 'meta-llama/Llama-3-8B-Instruct' },
                        { text: 'Llama 3 70B Instruct', value: 'meta-llama/Llama-3-70B-Instruct' },
                        { text: 'Code Llama 34B Instruct', value: 'codellama/CodeLlama-34b-Instruct' }
                    ],
                    promptMenu: [
                        'Gibberish (probably does not work) By: u/Fkquaps',
                        'PenguinBot (Pre Circlelabs) By: JeremyGamer13',
                        'Stand Up Comedian (Character) By: devisasari',
                        'Lunatic (Character) By: devisasari',
                        'Lua Console From awesomegptprompts.com',
                        'Advertiser (Character) By: devisasari',
                        'Minecraft Commander (Idea from Greedy Allay)'
                    ],
                    mergeTypes: [
                        { text: 'Merge/Update existing chats', value: 'Merge/Update existing chats' },
                        { text: 'Remove all chatbots and import', value: 'Remove all chatbots and import' }
                    ]
                }
            };
        }

        set_api_key({ KEY }) {
            this.apiKey = (KEY || '').trim();
        }

        set_model({ MODEL }) {
            this.model = MODEL;
        }

        get_current_model() {
            return this.model;
        }

        async _chatRequest(messages) {
            if (!this.apiKey) return { error: 'API Key not set. Use "Set API Key to ..."' };

            const response = await fetch(`${API_BASE}/v1/chat/completions`, {
                method: 'POST',
                headers: this._authHeaders(true),
                body: JSON.stringify({ model: this.model, messages })
            });

            const data = await response.json();
            if (!response.ok) {
                return { error: data?.error || data?.detail || `HTTP ${response.status}` };
            }
            return data;
        }

        async _processImage(promptText) {
            if (!this.nextImage) {
                return { role: 'user', content: promptText };
            }

            try {
                const response = await fetch(this.nextImage);
                if (!response.ok) throw new Error(`Error al obtener la imagen: ${response.statusText}`);
                const blob = await response.blob();
                const base64Url = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                return {
                    role: 'user',
                    content: [
                        { type: 'text', text: promptText },
                        { type: 'image_url', image_url: { url: base64Url } }
                    ]
                };
            } catch (e) {
                console.error('No se pudo procesar la imagen:', e);
                return { role: 'user', content: promptText };
            } finally {
                this.nextImage = null;
            }
        }

        get_prompt({ TYPE }) {
            const prompts = {
                'Gibberish (probably does not work) By: u/Fkquaps': 'From now on you will respond everything replacing every letter of the alphabet with it rotated 13 places forward ...',
                'PenguinBot (Pre Circlelabs) By: JeremyGamer13': 'You are PenguinBot.\n\nYou live in Antarctica ...',
                'Stand Up Comedian (Character) By: devisasari': 'I want you to act as a stand-up comedian. I will provide you with some topics ...',
                'Lunatic (Character) By: devisasari': 'I want you to act as a lunatic. The lunatic\'s sentences are meaningless ...',
                'Lua Console From awesomegptprompts.com': 'I want you to act as a lua console. I will type code and you will reply with what the lua console should show ...',
                'Advertiser (Character) By: devisasari': 'I want you to act as an advertiser. You will create a campaign ...',
                'Minecraft Commander (Idea from Greedy Allay)': 'I want you to act as a Minecraft AI command creator ...'
            };
            return prompts[TYPE] || '';
        }

        async generate_text_nocontext({ PROMPT }) {
            const userMessage = await this._processImage(PROMPT);
            const data = await this._chatRequest([userMessage]);
            if (data.error) return `Error: ${data.error}`;
            return data?.choices?.[0]?.message?.content || 'Error: no response';
        }

        async send_text_to_chat({ PROMPT, chatID }) {
            if (!this.histories[chatID]) this.histories[chatID] = [];

            const userMessage = await this._processImage(PROMPT);
            this.histories[chatID].push(userMessage);

            const data = await this._chatRequest(this.histories[chatID]);
            if (data.error) return `Error: ${data.error}`;

            const reply = data?.choices?.[0]?.message?.content || 'Error: no response';
            this.histories[chatID].push({ role: 'assistant', content: reply });
            return reply;
        }

        attach_image({ URL }) {
            this.nextImage = URL;
        }

        inform_chat({ chatID, inform }) {
            if (!this.histories[chatID]) this.histories[chatID] = [];
            this.histories[chatID].push({ role: 'system', content: inform });
        }

        create_chatbot({ chatID }) {
            if (!this.histories[chatID]) this.histories[chatID] = [];
        }

        delete_chatbot({ chatID }) {
            delete this.histories[chatID];
        }

        reset_chat({ chatID }) {
            this.histories[chatID] = [];
        }

        get_chat_history({ chatID }) {
            return JSON.stringify(this.histories[chatID] || []);
        }

        import_history({ json, chatID }) {
            try {
                this.histories[chatID] = JSON.parse(json);
            } catch (e) {
                console.error('JSON inválido para el historial del chat.');
            }
        }

        import_chats_merge({ json, merge }) {
            try {
                const newChats = JSON.parse(json);
                if (merge === 'Remove all chatbots and import') {
                    this.histories = newChats;
                } else {
                    for (const id in newChats) {
                        this.histories[id] = newChats[id];
                    }
                }
            } catch (e) {
                console.error('JSON inválido para los chats.');
            }
        }

        all_chats() {
            return JSON.stringify(this.histories);
        }

        active_chats() {
            return Object.keys(this.histories);
        }

        async generate_image({ PROMPT }) {
            if (!this.apiKey) return 'Error: API Key not set. Use "Set API Key to ..."';

            // El endpoint nuevo exige de forma obligatoria las dimensiones width y height en query params
            const width = 512;
            const height = 512;

            const url = `${API_BASE}/image/${encodeURIComponent(PROMPT)}?json=true&nologo=true&width=${width}&height=${height}&model=${encodeURIComponent(this.imageModel)}`;
            const response = await fetch(url, { headers: this._authHeaders(false) });
            const data = await response.json();

            if (!response.ok) return `Error: ${data?.error || data?.detail || response.status}`;
            return data?.image_base64 || 'Error: no image';
        }
    }

    Scratch.extensions.register(new PangAI());
})(Scratch);
