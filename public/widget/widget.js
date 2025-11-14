(function() {
  'use strict';

  var ChatWidget = {
    config: null,
    socket: null,
    visitorId: null,
    conversationId: null,
    isOpen: false,
    isConnected: false,
    messageQueue: [],

    /**
     * Initialize widget
     */
    init: function(config) {
      this.config = config;
      this.visitorId = this.getOrCreateVisitorId();

      this.createWidget();
      this.connectWebSocket();
      this.attachEventListeners();

      console.log('Chat Widget initialized:', config.businessId);
    },

    /**
     * Get or create visitor ID
     */
    getOrCreateVisitorId: function() {
      var key = 'chat_visitor_id_' + this.config.businessId;
      var visitorId = localStorage.getItem(key);

      if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(key, visitorId);
      }

      return visitorId;
    },

    /**
     * Create widget HTML
     */
    createWidget: function() {
      var position = this.config.position || 'bottom-right';
      var positionClass = 'cw-' + position;

      var html = '\
        <div id="chat-widget" class="cw-widget ' + positionClass + '">\
          <!-- Widget Button -->\
          <div id="cw-button" class="cw-button">\
            <svg class="cw-icon cw-icon-chat" viewBox="0 0 24 24" fill="currentColor">\
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>\
            </svg>\
            <svg class="cw-icon cw-icon-close" viewBox="0 0 24 24" fill="currentColor">\
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>\
            </svg>\
            <span id="cw-unread-badge" class="cw-unread-badge" style="display: none;">0</span>\
          </div>\
          <!-- Widget Window -->\
          <div id="cw-window" class="cw-window">\
            <!-- Header -->\
            <div class="cw-header">\
              <div class="cw-header-content">\
                <div class="cw-header-avatar">\
                  <svg viewBox="0 0 24 24" fill="currentColor">\
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>\
                  </svg>\
                </div>\
                <div class="cw-header-info">\
                  <div class="cw-header-title">' + this.escapeHtml(this.config.botName) + '</div>\
                  <div class="cw-header-status">\
                    <span class="cw-status-dot"></span>\
                    <span id="cw-status-text">Online</span>\
                  </div>\
                </div>\
              </div>\
              <button id="cw-minimize" class="cw-minimize-btn">\
                <svg viewBox="0 0 24 24" fill="currentColor">\
                  <path d="M19 13H5v-2h14v2z"/>\
                </svg>\
              </button>\
            </div>\
            <!-- Messages -->\
            <div id="cw-messages" class="cw-messages">\
              <div class="cw-welcome-message">' + this.escapeHtml(this.config.welcomeMessage) + '</div>\
            </div>\
            <!-- Typing Indicator -->\
            <div id="cw-typing" class="cw-typing" style="display: none;">\
              <span class="cw-typing-dot"></span>\
              <span class="cw-typing-dot"></span>\
              <span class="cw-typing-dot"></span>\
            </div>\
            <!-- Input -->\
            <div class="cw-input-container">\
              <textarea id="cw-input" class="cw-input" placeholder="Type your message..." rows="1"></textarea>\
              <button id="cw-send" class="cw-send-btn">\
                <svg viewBox="0 0 24 24" fill="currentColor">\
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>\
                </svg>\
              </button>\
            </div>\
            <!-- Branding -->\
            ' + (this.config.showBranding !== false ? '<div class="cw-branding">Powered by BizNavigate</div>' : '') + '\
          </div>\
        </div>\
      ';

      document.body.insertAdjacentHTML('beforeend', html);

      // Apply custom color
      if (this.config.primaryColor) {
        var style = document.createElement('style');
        style.textContent = '\
          .cw-button { background-color: ' + this.config.primaryColor + ' !important; }\
          .cw-header { background-color: ' + this.config.primaryColor + ' !important; }\
          .cw-message-bot { background-color: ' + this.config.primaryColor + '15 !important; }\
          .cw-send-btn:hover { background-color: ' + this.config.primaryColor + '20 !important; }\
        ';
        document.head.appendChild(style);
      }
    },

    /**
     * Connect WebSocket
     */
    connectWebSocket: function() {
      var self = this;
      var wsUrl = this.config.wsUrl + '/widget';

      try {
        this.socket = io(wsUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
        });

        this.socket.on('connect', function() {
          console.log('WebSocket connected');
          self.isConnected = true;
          self.updateStatus('Online');

          // Initialize widget session
          self.socket.emit('widget:init', {
            businessId: self.config.businessId,
            visitorId: self.visitorId,
            pageUrl: window.location.href,
          });
        });

        this.socket.on('disconnect', function() {
          console.log('WebSocket disconnected');
          self.isConnected = false;
          self.updateStatus('Offline');
        });

        this.socket.on('widget:initialized', function(data) {
          console.log('Widget initialized:', data);
          self.conversationId = data.conversationId;

          // Load message history
          if (data.messages && data.messages.length > 0) {
            data.messages.forEach(function(msg) {
              self.addMessage(msg.text, msg.sender === 'lead' ? 'user' : 'bot', false);
            });
          }
        });

        this.socket.on('widget:message:sent', function(data) {
          // Message confirmed by server
          console.log('Message sent:', data);
        });

        this.socket.on('widget:message:received', function(data) {
          console.log('Bot response received:', data);
          self.addMessage(data.text, 'bot', true);
          self.hideTyping();
          self.showNotification();
        });

        this.socket.on('widget:typing', function(data) {
          if (data.sender === 'bot') {
            self.showTyping();
          } else {
            self.hideTyping();
          }
        });

        this.socket.on('widget:error', function(data) {
          console.error('Widget error:', data);
          alert('Error: ' + data.message);
        });

      } catch (error) {
        console.error('WebSocket connection failed, using HTTP fallback:', error);
        this.isConnected = false;
        this.initHttpFallback();
      }
    },

    /**
     * Initialize HTTP fallback
     */
    initHttpFallback: function() {
      var self = this;

      // Initialize session
      this.httpRequest('POST', '/widget/init', {
        businessId: this.config.businessId,
        visitorId: this.visitorId,
        pageUrl: window.location.href,
      }).then(function(data) {
        console.log('HTTP fallback initialized:', data);
        self.conversationId = data.conversationId;

        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(function(msg) {
            self.addMessage(msg.text, msg.sender === 'lead' ? 'user' : 'bot', false);
          });
        }
      });

      // Poll for new messages every 3 seconds
      setInterval(function() {
        if (!self.isConnected) {
          self.pollMessages();
        }
      }, 3000);
    },

    /**
     * Poll for new messages (HTTP fallback)
     */
    pollMessages: function() {
      var self = this;
      this.httpRequest('GET', '/widget/history?businessId=' + this.config.businessId + '&visitorId=' + this.visitorId)
        .then(function(messages) {
          // Check for new messages
          // Implementation depends on tracking last message ID
        });
    },

    /**
     * Make HTTP request
     */
    httpRequest: function(method, url, data) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader('Content-Type', 'application/json');

        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.statusText));
          }
        };

        xhr.onerror = function() {
          reject(new Error('Network error'));
        };

        if (data) {
          xhr.send(JSON.stringify(data));
        } else {
          xhr.send();
        }
      });
    },

    /**
     * Attach event listeners
     */
    attachEventListeners: function() {
      var self = this;
      var button = document.getElementById('cw-button');
      var minimizeBtn = document.getElementById('cw-minimize');
      var sendBtn = document.getElementById('cw-send');
      var input = document.getElementById('cw-input');

      button.addEventListener('click', function() {
        self.toggleWidget();
      });

      minimizeBtn.addEventListener('click', function() {
        self.closeWidget();
      });

      sendBtn.addEventListener('click', function() {
        self.sendMessage();
      });

      input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          self.sendMessage();
        }
      });

      // Auto-resize textarea
      input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 100) + 'px';
      });
    },

    /**
     * Toggle widget
     */
    toggleWidget: function() {
      if (this.isOpen) {
        this.closeWidget();
      } else {
        this.openWidget();
      }
    },

    /**
     * Open widget
     */
    openWidget: function() {
      var window = document.getElementById('cw-window');
      var button = document.getElementById('cw-button');

      window.style.display = 'flex';
      button.classList.add('cw-open');
      this.isOpen = true;

      // Clear unread badge
      this.clearUnreadBadge();

      // Focus input
      setTimeout(function() {
        document.getElementById('cw-input').focus();
      }, 300);

      // Scroll to bottom
      this.scrollToBottom();
    },

    /**
     * Close widget
     */
    closeWidget: function() {
      var window = document.getElementById('cw-window');
      var button = document.getElementById('cw-button');

      window.style.display = 'none';
      button.classList.remove('cw-open');
      this.isOpen = false;
    },

    /**
     * Send message
     */
    sendMessage: function() {
      var input = document.getElementById('cw-input');
      var message = input.value.trim();

      if (!message) return;

      // Add message to UI
      this.addMessage(message, 'user', true);

      // Clear input
      input.value = '';
      input.style.height = 'auto';

      // Send via WebSocket or HTTP
      var messageData = {
        businessId: this.config.businessId,
        visitorId: this.visitorId,
        message: message,
        pageUrl: window.location.href,
        pageTitle: document.title,
      };

      if (this.isConnected && this.socket) {
        this.socket.emit('widget:message', messageData);
      } else {
        var self = this;
        this.httpRequest('POST', '/widget/message', messageData)
          .then(function(data) {
            console.log('Message sent via HTTP:', data);
            // Simulate bot response after delay
            setTimeout(function() {
              self.pollMessages();
            }, 2000);
          })
          .catch(function(error) {
            console.error('Failed to send message:', error);
          });
      }
    },

    /**
     * Add message to chat
     */
    addMessage: function(text, sender, animate) {
      var messagesContainer = document.getElementById('cw-messages');
      var messageClass = sender === 'user' ? 'cw-message-user' : 'cw-message-bot';

      var messageEl = document.createElement('div');
      messageEl.className = 'cw-message ' + messageClass;
      messageEl.textContent = text;

      if (animate) {
        messageEl.classList.add('cw-message-animate');
      }

      messagesContainer.appendChild(messageEl);
      this.scrollToBottom();
    },

    /**
     * Show typing indicator
     */
    showTyping: function() {
      document.getElementById('cw-typing').style.display = 'flex';
      this.scrollToBottom();
    },

    /**
     * Hide typing indicator
     */
    hideTyping: function() {
      document.getElementById('cw-typing').style.display = 'none';
    },

    /**
     * Scroll to bottom
     */
    scrollToBottom: function() {
      var messagesContainer = document.getElementById('cw-messages');
      setTimeout(function() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    },

    /**
     * Update status
     */
    updateStatus: function(status) {
      var statusEl = document.getElementById('cw-status-text');
      if (statusEl) {
        statusEl.textContent = status;
      }
    },

    /**
     * Show notification (when widget is closed)
     */
    showNotification: function() {
      if (!this.isOpen) {
        var badge = document.getElementById('cw-unread-badge');
        var count = parseInt(badge.textContent) || 0;
        badge.textContent = count + 1;
        badge.style.display = 'block';
      }
    },

    /**
     * Clear unread badge
     */
    clearUnreadBadge: function() {
      var badge = document.getElementById('cw-unread-badge');
      badge.textContent = '0';
      badge.style.display = 'none';
    },

    /**
     * Escape HTML
     */
    escapeHtml: function(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
  };

  // Expose to global scope
  window.ChatWidgetApp = ChatWidget;

  // Auto-initialize if config is provided
  if (window.ChatWidgetConfig) {
    ChatWidget.init(window.ChatWidgetConfig);
  }
})();
