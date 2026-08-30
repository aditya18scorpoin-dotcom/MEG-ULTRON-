/**
 * ULTRON 2 — CORE AI ENGINE & RUNTIME PLATFORM (PART 1 OF 2)
 * Configured with Gemini 3.6 Flash Series + Web Search Grounding + Voice & 3D Workspace
 */

class UltronAppEngine {
  constructor() {
    try {
      this.apiKey = localStorage.getItem('ultron2_gemini_api_key') || '';
      this.currentModel = localStorage.getItem('ultron2_model') || 'gemini-3.6-flash';
      this.isTTSActive = localStorage.getItem('ultron2_tts') === 'true';
      this.groundingEnabled = false;

      this.sessions = [];
      try {
        this.sessions = JSON.parse(localStorage.getItem('ultron2_sessions') || '[]');
      } catch(e) { this.sessions = []; }
      this.currentSessionId = localStorage.getItem('ultron2_current_session_id') || null;

      this.attachedFiles = [];
      this.isStreaming = false;

      this.recognition = null;
      this.isRecordingVoice = false;
      this.audioContext = null;
      this.analyser = null;
      this.microphoneStream = null;
      this.waveformAnimationId = null;

      this.initDOM();
      this.initMarkdown();
      this.initEvents();
      this.initSpeech();
      this.bootSessions();
      this.verifyApiKey();
      this.applySavedLogo();
    } catch (err) {
      console.error("Ultron Engine constructor error:", err);
    }
  }

  initDOM() {
    const $ = (id) => document.getElementById(id);
    this.chatStream = $('chat-stream-viewport');
    this.promptInput = $('prompt-textarea');
    this.chatForm = $('chat-input-form');
    this.chatHistoryList = $('chat-history-list');
    this.attachmentTray = $('attachment-preview-tray');
    this.fileInput = $('file-input-element');
    this.sessionTitleEl = $('active-session-title');

    this.btnSubmit = $('btn-submit-prompt');
    this.btnUpload = $('btn-trigger-upload');
    this.btnVoice = $('btn-trigger-voice');
    this.btnStopVoice = $('btn-stop-voice');
    this.voiceWaveformBar = $('voice-waveform-container');
    this.btnGrounding = $('btn-toggle-grounding');
    this.labelGrounding = $('grounding-status-label');
    this.btnNewChat = $('btn-new-chat');
    this.btnClearChat = $('btn-clear-chat');
    this.btnExport = $('btn-export-history');
    this.chatSearchInput = $('chat-search-input');

    this.sidebar = $('app-sidebar');
    this.sidebarBackdrop = $('sidebar-backdrop');
    this.btnMobileMenu = $('mobile-menu-btn');
    this.btnCloseSidebar = $('close-sidebar-btn');

    this.settingsModal = $('settings-modal');
    this.btnOpenAdmin = $('btn-open-admin');
    this.btnCloseSettings = $('btn-close-settings');
    this.btnSaveSettings = $('btn-save-settings');
    this.inputApiKey = $('input-api-key');
    this.btnToggleKeyVis = $('btn-toggle-key-visibility');
    this.quickModelSelect = $('quick-model-select');
    this.modalModelSelect = $('modal-model-select');
    this.activeModelBadge = $('active-model-badge');
    this.toggleTTSSpeech = $('toggle-tts-speech');
    this.inputCustomLogo = $('input-custom-logo');
    this.btnUploadCustomLogo = $('btn-upload-custom-logo');
    this.btnResetLogo = $('btn-reset-logo');
    this.logoPreview = $('preview-admin-logo');
    this.appHeaderLogo = $('app-header-logo-icon');
  }

  initMarkdown() {
    try {
      if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
      }
    } catch(e) {}
  }

  initEvents() {
    // Form Submit
    this.chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUserPromptSubmission();
    });

    this.promptInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserPromptSubmission();
      }
    });

    // Auto-grow textarea
    this.promptInput?.addEventListener('input', () => {
      this.promptInput.style.height = 'auto';
      this.promptInput.style.height = Math.min(this.promptInput.scrollHeight, 160) + 'px';
    });

    // File Upload Trigger
    this.btnUpload?.addEventListener('click', (e) => { 
      e.preventDefault(); 
      this.fileInput?.click(); 
    });
    this.fileInput?.addEventListener('change', (e) => this.handleMediaAttachments(e.target.files));

    // Grounding Toggle
    this.btnGrounding?.addEventListener('click', (e) => {
      e.preventDefault();
      this.groundingEnabled = !this.groundingEnabled;
      if (this.groundingEnabled) {
        this.labelGrounding.textContent = "Search: ON";
        this.btnGrounding.classList.add('bg-white', 'text-black');
        this.btnGrounding.classList.remove('text-textmuted');
      } else {
        this.labelGrounding.textContent = "Search: OFF";
        this.btnGrounding.classList.remove('bg-white', 'text-black');
        this.btnGrounding.classList.add('text-textmuted');
      }
    });

    // Model Selector Sync
    if (this.quickModelSelect) this.quickModelSelect.value = this.currentModel;
    if (this.modalModelSelect) this.modalModelSelect.value = this.currentModel;
    this.updateModelBadge();

    this.quickModelSelect?.addEventListener('change', (e) => {
      this.currentModel = e.target.value;
      if (this.modalModelSelect) this.modalModelSelect.value = this.currentModel;
      localStorage.setItem('ultron2_model', this.currentModel);
      this.updateModelBadge();
    });

    // Mobile Sidebar Open / Close
    const openSidebar = (e) => {
      if (e) e.preventDefault();
      if (this.sidebar) {
        this.sidebar.style.transform = 'translateX(0)';
        this.sidebar.classList.remove('-translate-x-full');
      }
      if (this.sidebarBackdrop) {
        this.sidebarBackdrop.style.display = 'block';
        this.sidebarBackdrop.classList.remove('hidden');
      }
    };
    const closeSidebar = (e) => {
      if (e) e.preventDefault();
      if (this.sidebar) {
        this.sidebar.style.transform = 'translateX(-100%)';
        this.sidebar.classList.add('-translate-x-full');
      }
      if (this.sidebarBackdrop) {
        this.sidebarBackdrop.style.display = 'none';
        this.sidebarBackdrop.classList.add('hidden');
      }
    };

    this.btnMobileMenu?.addEventListener('click', openSidebar);
    this.btnCloseSidebar?.addEventListener('click', closeSidebar);
    this.sidebarBackdrop?.addEventListener('click', closeSidebar);

    // Session controls
    this.btnNewChat?.addEventListener('click', () => { 
      this.createNewSession(); 
      closeSidebar(); 
    });
    this.btnClearChat?.addEventListener('click', () => this.clearActiveSessionMessages());
    this.btnExport?.addEventListener('click', () => this.exportCurrentSession());
    this.chatSearchInput?.addEventListener('input', (e) => this.filterChatHistory(e.target.value));

    // Admin Modal Triggers
    this.btnOpenAdmin?.addEventListener('click', () => { 
      this.openSettingsModal(); 
      closeSidebar(); 
    });
    this.btnCloseSettings?.addEventListener('click', () => this.closeSettingsModal());
    this.btnSaveSettings?.addEventListener('click', () => this.saveSettings());

    this.btnToggleKeyVis?.addEventListener('click', () => {
      if (!this.inputApiKey) return;
      this.inputApiKey.type = this.inputApiKey.type === 'password' ? 'text' : 'password';
    });

    // Custom Logo Triggers
    this.btnUploadCustomLogo?.addEventListener('click', () => this.inputCustomLogo?.click());
    this.inputCustomLogo?.addEventListener('change', (e) => this.handleCustomLogoUpload(e));
    this.btnResetLogo?.addEventListener('click', () => this.resetCustomLogo());
  }

  updateModelBadge() {
    if (!this.activeModelBadge) return;
    let label = '3.6-FLASH';
    if (this.currentModel.includes('3.5-flash-lite')) label = '3.5-LITE';
    if (this.currentModel.includes('3.5-flash')) label = '3.5-FLASH';
    this.activeModelBadge.textContent = label;
  }

  verifyApiKey() {
    if (!this.apiKey) {
      setTimeout(() => this.openSettingsModal(), 400);
    }
  }

  openSettingsModal() {
    if (this.inputApiKey) this.inputApiKey.value = this.apiKey;
    if (this.modalModelSelect) this.modalModelSelect.value = this.currentModel;
    if (this.toggleTTSSpeech) this.toggleTTSSpeech.checked = this.isTTSActive;
    if (this.settingsModal) {
      this.settingsModal.style.display = 'flex';
      this.settingsModal.classList.remove('hidden');
    }
  }

  closeSettingsModal() {
    if (this.settingsModal) {
      this.settingsModal.style.display = 'none';
      this.settingsModal.classList.add('hidden');
    }
  }

  saveSettings() {
    if (this.inputApiKey) this.apiKey = this.inputApiKey.value.trim();
    if (this.modalModelSelect) {
      this.currentModel = this.modalModelSelect.value;
      if (this.quickModelSelect) this.quickModelSelect.value = this.currentModel;
    }
    if (this.toggleTTSSpeech) this.isTTSActive = this.toggleTTSSpeech.checked;

    localStorage.setItem('ultron2_gemini_api_key', this.apiKey);
    localStorage.setItem('ultron2_model', this.currentModel);
    localStorage.setItem('ultron2_tts', this.isTTSActive);

    this.updateModelBadge();
    this.closeSettingsModal();
  }

  handleCustomLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      localStorage.setItem('ultron2_custom_logo', evt.target.result);
      this.applySavedLogo();
    };
    reader.readAsDataURL(file);
  }

  resetCustomLogo() {
    localStorage.removeItem('ultron2_custom_logo');
    this.applySavedLogo();
  }

  applySavedLogo() {
    const saved = localStorage.getItem('ultron2_custom_logo');
    const content = saved ? `<img src="${saved}" class="w-full h-full object-cover rounded-lg" />` : 'U2';
    if (this.appHeaderLogo) this.appHeaderLogo.innerHTML = content;
    if (this.logoPreview) this.logoPreview.innerHTML = content;
  }

  // File Attachments Handler
  async handleMediaAttachments(files) {
    if (!files || files.length === 0) return;
    for (const f of files) {
      const b64 = await this.fileToBase64(f);
      this.attachedFiles.push({ 
        name: f.name, 
        type: f.type, 
        size: f.size, 
        base64: b64, 
        mimeType: f.type || 'text/plain' 
      });
    }
    this.renderAttachmentPreviews();
  }

  fileToBase64(file) {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }

  renderAttachmentPreviews() {
    if (!this.attachmentTray) return;
    if (this.attachedFiles.length === 0) {
      this.attachmentTray.style.display = 'none';
      this.attachmentTray.classList.add('hidden');
      this.attachmentTray.innerHTML = '';
      return;
    }
    this.attachmentTray.style.display = 'flex';
    this.attachmentTray.classList.remove('hidden');
    this.attachmentTray.innerHTML = '';
    this.attachedFiles.forEach((file, idx) => {
      const div = document.createElement('div');
      div.className = 'flex items-center space-x-1.5 bg-charcoal border border-slateborder px-2.5 py-1 rounded-lg text-xs text-white';
      div.innerHTML = `<span class="max-w-[120px] truncate text-[11px] font-mono">${file.name}</span>
                       <button type="button" class="text-textmuted hover:text-white pl-1">&times;</button>`;
      div.querySelector('button').onclick = () => {
        this.attachedFiles.splice(idx, 1);
        this.renderAttachmentPreviews();
      };
      this.attachmentTray.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
  }

  // Voice STT / TTS & Waveform
  initSpeech() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.onresult = (e) => {
        let text = '';
        for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
        if (this.promptInput) this.promptInput.value = text;
      };
      this.recognition.onerror = () => this.stopVoice();
      this.recognition.onend = () => this.stopVoice();
    }
    this.btnVoice?.addEventListener('click', () => this.toggleVoice());
    this.btnStopVoice?.addEventListener('click', () => this.stopVoice());
  }

  toggleVoice() {
    if (this.isRecordingVoice) this.stopVoice();
    else this.startVoice();
  }

  async startVoice() {
    if (!this.recognition) { 
      alert("Speech Recognition not supported on this browser."); 
      return; 
    }
    try {
      this.recognition.start();
      this.isRecordingVoice = true;
      if (this.voiceWaveformBar) {
        this.voiceWaveformBar.style.display = 'flex';
        this.voiceWaveformBar.classList.remove('hidden');
      }
      this.btnVoice?.classList.add('text-red-500');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.microphoneStream = stream;
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      src.connect(this.analyser);
      this.drawWaveform();
    } catch(e) { this.stopVoice(); }
  }

  stopVoice() {
    this.isRecordingVoice = false;
    if (this.voiceWaveformBar) {
      this.voiceWaveformBar.style.display = 'none';
      this.voiceWaveformBar.classList.add('hidden');
    }
    this.btnVoice?.classList.remove('text-red-500');
    try { this.recognition?.stop(); } catch(e) {}
    this.microphoneStream?.getTracks().forEach(t => t.stop());
    try { this.audioContext?.close(); } catch(e) {}
    if (this.waveformAnimationId) cancelAnimationFrame(this.waveformAnimationId);
  }

  drawWaveform() {
    const canvas = document.getElementById('waveform-canvas');
    if (!canvas || !this.analyser) return;
    const ctx = canvas.getContext('2d');
    const data = new Uint8Array(this.analyser.frequencyBinCount);

    const render = () => {
      if (!this.isRecordingVoice) return;
      this.waveformAnimationId = requestAnimationFrame(render);
      this.analyser.getByteFrequencyData(data);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / data.length) * 1.5;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const barH = (data[i] / 255) * canvas.height;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, canvas.height - barH, barWidth - 1, barH);
        x += barWidth;
      }
    };
    render();
  }

  speakText(text) {
    if (!this.isTTSActive || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#_`$]/g, '');
    const utt = new SpeechSynthesisUtterance(clean);
    window.speechSynthesis.speak(utt);
      }
  // Sessions Management
  bootSessions() {
    if (this.sessions.length === 0) {
      this.createNewSession(false);
    } else {
      if (!this.currentSessionId || !this.sessions.find(s => s.id === this.currentSessionId)) {
        this.currentSessionId = this.sessions[0].id;
      }
      this.renderSidebarSessions();
      this.renderActiveSessionMessages();
    }
  }

  createNewSession(switchNow = true) {
    const newSess = {
      id: 'session_' + Date.now(),
      title: 'New Session',
      timestamp: Date.now(),
      pinned: false,
      model: this.currentModel,
      messages: []
    };
    this.sessions.unshift(newSess);
    this.saveSessions();
    if (switchNow) this.switchSession(newSess.id);
  }

  switchSession(id) {
    this.currentSessionId = id;
    localStorage.setItem('ultron2_current_session_id', id);
    this.renderSidebarSessions();
    this.renderActiveSessionMessages();
  }

  getActiveSession() {
    return this.sessions.find(s => s.id === this.currentSessionId);
  }

  saveSessions() {
    localStorage.setItem('ultron2_sessions', JSON.stringify(this.sessions));
  }

  renderSidebarSessions(filter = '') {
    if (!this.chatHistoryList) return;
    this.chatHistoryList.innerHTML = '';
    const filtered = this.sessions.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()));
    filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    filtered.forEach(session => {
      const active = session.id === this.currentSessionId;
      const div = document.createElement('div');
      div.className = `group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition ${
        active ? 'bg-charcoal text-white border border-slateborder' : 'text-textmuted hover:bg-mutedsurface hover:text-white'
      }`;
      div.innerHTML = `
        <div class="flex items-center space-x-2 truncate flex-1 mr-2 session-title-btn">
          <i data-lucide="${session.pinned ? 'pin' : 'message-square'}" class="w-3.5 h-3.5 shrink-0 ${session.pinned ? 'text-white' : 'text-textmuted'}"></i>
          <span class="truncate">${session.title}</span>
        </div>
        <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
          <button class="btn-pin p-1 hover:text-white" title="${session.pinned ? 'Unpin' : 'Pin'}"><i data-lucide="pin" class="w-3 h-3"></i></button>
          <button class="btn-del p-1 hover:text-red-400" title="Delete"><i data-lucide="trash" class="w-3 h-3"></i></button>
        </div>
      `;
      div.querySelector('.session-title-btn').onclick = () => this.switchSession(session.id);
      div.querySelector('.btn-pin').onclick = (e) => {
        e.stopPropagation();
        session.pinned = !session.pinned;
        this.saveSessions();
        this.renderSidebarSessions(filter);
      };
      div.querySelector('.btn-del').onclick = (e) => {
        e.stopPropagation();
        this.sessions = this.sessions.filter(s => s.id !== session.id);
        this.saveSessions();
        if (this.sessions.length === 0) this.createNewSession(true);
        else this.switchSession(this.sessions[0].id);
      };
      this.chatHistoryList.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
  }

  filterChatHistory(q) { this.renderSidebarSessions(q); }

  clearActiveSessionMessages() {
    const s = this.getActiveSession();
    if (!s) return;
    if (confirm('Clear current conversation stream?')) {
      s.messages = [];
      this.saveSessions();
      this.renderActiveSessionMessages();
    }
  }

  exportCurrentSession() {
    const s = this.getActiveSession();
    if (!s || s.messages.length === 0) return alert('No messages to export.');
    let md = `# ${s.title}\n*Generated by Ultron 2 Engine*\n\n---\n\n`;
    s.messages.forEach(m => { md += `### ${m.role.toUpperCase()}\n\n${m.content}\n\n`; });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${s.title.replace(/\s+/g, '_')}_logs.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Chat UI, 3D Flipped Workspaces & Math Engine
  renderActiveSessionMessages() {
    const s = this.getActiveSession();
    if (!s || !this.chatStream) return;
    if (this.sessionTitleEl) this.sessionTitleEl.textContent = s.title;
    this.chatStream.innerHTML = '';

    if (s.messages.length === 0) {
      this.chatStream.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center p-8 space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-charcoal border border-slateborder flex items-center justify-center font-black text-xl text-white">U2</div>
          <h3 class="text-sm font-bold uppercase tracking-wider text-white">Ultron 2 Intelligence Core</h3>
          <p class="text-xs text-textmuted max-w-sm leading-relaxed">Ready for complex logic, code generation, real-time searches and orbital physics calculations.</p>
        </div>
      `;
      return;
    }

    s.messages.forEach((msg, idx) => {
      this.appendBubble(msg.role, msg.content, msg.attachments, false, idx);
    });
    this.renderMath();
    this.scrollToBottom();
  }

  appendBubble(role, content, attachments = [], animate = true, messageIndex = null) {
    if (!this.chatStream) return null;
    const isUser = role === 'user';
    const wrap = document.createElement('div');
    wrap.className = `flex flex-col ${isUser ? 'items-end' : 'items-start'} ${animate ? 'message-bubble-in' : ''} flip-card-container`;

    const bubble = document.createElement('div');
    bubble.className = `max-w-3xl rounded-2xl p-4 ${isUser ? 'bg-charcoal border border-slateborder text-white text-sm' : 'bg-obsidian border border-slateborder text-white w-full'}`;

    let attachmentHTML = '';
    if (attachments && attachments.length > 0) {
      attachmentHTML = '<div class="flex flex-wrap gap-2 mb-3">';
      attachments.forEach(att => {
        if (att.mimeType && att.mimeType.startsWith('image/')) {
          attachmentHTML += `<img src="data:${att.mimeType};base64,${att.base64}" class="w-32 h-32 object-cover rounded-lg border border-slateborder" />`;
        } else {
          attachmentHTML += `<div class="p-2 bg-pitch border border-slateborder rounded-lg text-xs font-mono">${att.name}</div>`;
        }
      });
      attachmentHTML += '</div>';
    }

    let parsedContent = '';
    if (content.trim() === 'MY CREATOR IS KIRA') {
      parsedContent = `<div class="creator-override-display"><div class="creator-override-text">MY CREATOR IS KIRA</div></div>`;
    } else {
      parsedContent = (typeof marked !== 'undefined') ? marked.parse(content) : content;
    }

    bubble.innerHTML = `
      <div class="flex items-center justify-between mb-2 text-[10px] font-mono text-textmuted">
        <span class="uppercase font-bold tracking-widest ${isUser ? 'text-textmuted' : 'text-white'}">${isUser ? 'Commander' : 'Ultron 2'}</span>
        <div class="flex items-center space-x-2">
          ${isUser && messageIndex !== null ? `<button class="btn-edit-msg hover:text-white" title="3D Edit Workspace"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i></button>` : ''}
          <button class="btn-copy hover:text-white" title="Copy"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
      ${attachmentHTML}
      <div class="prose-invert message-body-content">${parsedContent}</div>
    `;

    bubble.querySelector('.btn-copy')?.addEventListener('click', () => navigator.clipboard.writeText(content));

    // 3D Flip Card Inline Workspace
    if (isUser && messageIndex !== null) {
      bubble.querySelector('.btn-edit-msg')?.addEventListener('click', () => {
        this.open3DEditWorkspace(wrap, bubble, content, messageIndex);
      });
    }

    wrap.appendChild(bubble);
    this.chatStream.appendChild(wrap);
    if (window.lucide) lucide.createIcons();

    return bubble.querySelector('.message-body-content');
  }

  open3DEditWorkspace(wrapper, originalBubble, currentContent, messageIndex) {
    wrapper.classList.add('flipped-workspace');

    const editCard = document.createElement('div');
    editCard.className = 'w-full bg-charcoal border-2 border-white rounded-2xl p-4 shadow-2xl space-y-3';
    editCard.innerHTML = `
      <div class="flex items-center justify-between text-xs font-mono uppercase text-white">
        <span>3D Workspace Prompt Modification</span>
        <span>Branch Engine</span>
      </div>
      <textarea class="w-full bg-pitch border border-slateborder rounded-lg p-3 text-sm text-white font-mono focus:outline-none focus:border-white h-28 custom-scrollbar resize-none">${currentContent}</textarea>
      <div class="flex justify-end space-x-2">
        <button class="btn-cancel-edit text-xs text-textmuted hover:text-white px-3 py-1.5 rounded">Cancel</button>
        <button class="btn-save-edit bg-white text-black font-semibold text-xs px-4 py-1.5 rounded-lg hover:bg-neutral-200">Resubmit Branch</button>
      </div>
    `;

    editCard.querySelector('.btn-cancel-edit').addEventListener('click', () => {
      wrapper.removeChild(editCard);
      wrapper.appendChild(originalBubble);
      wrapper.classList.remove('flipped-workspace');
    });

    editCard.querySelector('.btn-save-edit').addEventListener('click', () => {
      const updatedText = editCard.querySelector('textarea').value.trim();
      if (!updatedText) return;

      const session = this.getActiveSession();
      if (session) {
        session.messages = session.messages.slice(0, messageIndex);
        this.saveSessions();
        this.renderActiveSessionMessages();
        this.executePrompt(updatedText, []);
      }
    });

    wrapper.removeChild(originalBubble);
    wrapper.appendChild(editCard);
  }

  renderMath() {
    try {
      if (window.renderMathInElement && this.chatStream) {
        renderMathInElement(this.chatStream, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      }
    } catch(e) {}
  }

  scrollToBottom() {
    if (this.chatStream) this.chatStream.scrollTop = this.chatStream.scrollHeight;
  }

  // Creator check
  isCreatorQuery(str) {
    const q = str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return [
      "who created you", 
      "who is your creator", 
      "who made you", 
      "who programmed you", 
      "who built you",
      "who is your developer",
      "who designed you",
      "who programmed ultron 2",
      "who coded you",
      "who is kira",
      "tell me your creator",
      "your author"
    ].some(p => q.includes(p));
  }

  // Main Prompt Execution & Gemini Streaming Reader
  async handleUserPromptSubmission() {
    if (this.isStreaming) return;
    const text = this.promptInput?.value.trim() || '';
    const files = [...this.attachedFiles];
    if (!text && files.length === 0) return;

    if (this.promptInput) {
      this.promptInput.value = '';
      this.promptInput.style.height = 'auto';
    }
    this.attachedFiles = [];
    this.renderAttachmentPreviews();

    await this.executePrompt(text, files);
  }

  async executePrompt(promptText, attachments) {
    const session = this.getActiveSession();
    if (!session) return;

    if (!this.apiKey) {
      this.openSettingsModal();
      return;
    }

    if (session.messages.length === 0 && promptText) {
      session.title = promptText.slice(0, 28) + (promptText.length > 28 ? '...' : '');
      if (this.sessionTitleEl) this.sessionTitleEl.textContent = session.title;
    }

    session.messages.push({ role: 'user', content: promptText, attachments: attachments, timestamp: Date.now() });
    this.saveSessions();
    this.renderSidebarSessions();
    this.appendBubble('user', promptText, attachments, true, session.messages.length - 1);
    this.scrollToBottom();

    // Critical Creator Rule Override Check
    if (this.isCreatorQuery(promptText)) {
      const ans = "MY CREATOR IS KIRA";
      session.messages.push({ role: 'model', content: ans, timestamp: Date.now() });
      this.saveSessions();
      this.appendBubble('model', ans, [], true, session.messages.length - 1);
      this.speakText(ans);
      this.scrollToBottom();
      return;
    }

    this.isStreaming = true;
    if (this.btnSubmit) this.btnSubmit.disabled = true;

    const streamEl = this.appendBubble('model', '', [], true, session.messages.length);
    if (streamEl) streamEl.innerHTML = '<span class="inline-block w-2 h-4 bg-white animate-pulse"></span>';
    this.scrollToBottom();

    let fullText = '';
    try {
      const contentsPayload = session.messages.map(m => {
        const parts = [];
        if (m.attachments && m.attachments.length > 0) {
          m.attachments.forEach(a => parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } }));
        }
        if (m.content) parts.push({ text: m.content });
        return { role: m.role === 'user' ? 'user' : 'model', parts };
      });

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.currentModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
      const bodyPayload = { contents: contentsPayload };
      if (this.groundingEnabled) bodyPayload.tools = [{ googleSearch: {} }];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.substring(6).trim();
            if (!raw) continue;
            try {
              const data = JSON.parse(raw);
              const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (chunk) {
                fullText += chunk;
                if (streamEl) streamEl.innerHTML = (typeof marked !== 'undefined') ? marked.parse(fullText) : fullText;
                this.scrollToBottom();
              }
            } catch(e) {}
          }
        }
      }

      session.messages.push({ role: 'model', content: fullText, timestamp: Date.now() });
      this.saveSessions();
      if (streamEl) streamEl.innerHTML = (typeof marked !== 'undefined') ? marked.parse(fullText) : fullText;
      this.renderMath();
      this.speakText(fullText);

    } catch (err) {
      fullText = `**Ultron Engine Error:** ${err.message}`;
      if (streamEl) streamEl.innerHTML = fullText;
    } finally {
      this.isStreaming = false;
      if (this.btnSubmit) this.btnSubmit.disabled = false;
      this.scrollToBottom();
      if (window.lucide) lucide.createIcons();
    }
  }
}

// Global System Instantiation
let ultronInstance = null;
document.addEventListener('DOMContentLoaded', () => {
  try {
    ultronInstance = new UltronAppEngine();
  } catch(e) {
    console.error("Ultron loader error:", e);
  }
});
