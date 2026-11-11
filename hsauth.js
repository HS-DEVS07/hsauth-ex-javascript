/**
 * HS DEVS AUTH - JavaScript / Node.js & Browser SDK
 * Zero external dependencies.
 */

class HSAuth {
  constructor({ name, ownerid, secret, version = '1.0', apiUrl = 'https://hsauth.mujahid.xyz/api/1.3/' }) {
    if (!name || !ownerid || !secret) {
      throw new Error('HSAuth requires name, ownerid, and secret.');
    }
    this.name = name;
    this.ownerid = ownerid;
    this.secret = secret;
    this.version = version;
    this.apiUrl = apiUrl.replace(/\/+$/, '') + '/';

    this.sessionId = null;
    this.initialized = false;
    this.userData = null;
    this.appData = null;
    this.heartbeatTimer = null;
    this.onMessageCallback = null;
  }

  getHwid() {
    if (typeof window !== 'undefined') {
      // Browser environment
      let stored = localStorage.getItem('hsauth_hwid');
      if (!stored) {
        stored = 'WEB-' + Math.random().toString(36).substring(2, 15) + '-' + navigator.userAgent.slice(0, 10);
        localStorage.setItem('hsauth_hwid', stored);
      }
      return stored;
    } else {
      // Node.js environment
      try {
        const os = require('os');
        const crypto = require('crypto');
        const str = os.hostname() + os.platform() + os.arch() + os.cpus().length;
        return crypto.createHash('sha256').update(str).digest('hex').slice(0, 32);
      } catch (e) {
        return 'NODE-HWID-' + Math.random().toString(36).slice(2, 10);
      }
    }
  }

  async _req(params) {
    if (!this.secret) {
      return { success: false, message: 'Application secret is required' };
    }
    params.name = this.name;
    params.ownerid = this.ownerid;
    params.secret = this.secret;

    const body = new URLSearchParams(params).toString();
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    try {
      return await res.json();
    } catch (e) {
      const text = await res.text();
      return { success: false, message: text };
    }
  }

  async init() {
    const res = await this._req({
      type: 'init',
      ver: this.version,
    });

    if (res.success) {
      this.sessionId = res.sessionid;
      this.appData = res.appinfo;
      this.initialized = true;
    }
    return res;
  }

  _checkInit() {
    if (!this.initialized) {
      throw new Error('You must call HSAuth.init() before executing actions.');
    }
  }

  async login(username, password) {
    this._checkInit();
    const res = await this._req({
      type: 'login',
      username,
      pass: password,
      hwid: this.getHwid(),
      sessionid: this.sessionId,
    });

    if (res.success) {
      this.userData = res.info;
      if (res.sessionid) this.sessionId = res.sessionid;
      this._handleActiveMessage(res.active_message);
    }
    return res;
  }

  async register(username, password, key, email = '') {
    this._checkInit();
    const res = await this._req({
      type: 'register',
      username,
      pass: password,
      key,
      email,
      hwid: this.getHwid(),
      sessionid: this.sessionId,
    });

    if (res.success) {
      this.userData = res.info;
      if (res.sessionid) this.sessionId = res.sessionid;
      this._handleActiveMessage(res.active_message);
    }
    return res;
  }

  async license(key) {
    this._checkInit();
    const res = await this._req({
      type: 'license',
      key,
      hwid: this.getHwid(),
      sessionid: this.sessionId,
    });

    if (res.success) {
      this.userData = res.info;
      if (res.sessionid) this.sessionId = res.sessionid;
      this._handleActiveMessage(res.active_message);
    }
    return res;
  }

  async check() {
    this._checkInit();
    const res = await this._req({
      type: 'check',
      sessionid: this.sessionId,
    });
    if (res.success) {
      this._handleActiveMessage(res.active_message);
    }
    return res;
  }

  async var(varid) {
    this._checkInit();
    const res = await this._req({
      type: 'var',
      varid,
      sessionid: this.sessionId,
    });
    return res.success ? (res.message || res.response) : null;
  }

  async getvar(varname) {
    return this.var(varname);
  }

  async setvar(varname, data) {
    this._checkInit();
    return await this._req({
      type: 'setvar',
      var: varname,
      data,
      sessionid: this.sessionId,
    });
  }

  async download(fileid) {
    this._checkInit();
    const res = await this._req({
      type: 'file',
      fileid,
      sessionid: this.sessionId,
    });
    return res.success ? res.contents : null;
  }

  async log(message) {
    this._checkInit();
    return await this._req({
      type: 'log',
      message,
      sessionid: this.sessionId,
    });
  }

  async fetchOnline() {
    this._checkInit();
    const res = await this._req({
      type: 'fetchOnline',
      sessionid: this.sessionId,
    });
    return res.success ? res.users : [];
  }

  async fetchStats() {
    this._checkInit();
    const res = await this._req({
      type: 'fetchStats',
      sessionid: this.sessionId,
    });
    if (res.success && res.appinfo) {
      this.appData = res.appinfo;
    }
    return res;
  }

  async logout() {
    this._checkInit();
    this.stopHeartbeat();
    const res = await this._req({
      type: 'logout',
      sessionid: this.sessionId,
    });
    this.sessionId = null;
    return res;
  }

  startHeartbeat(intervalSeconds = 30, onMessage = null) {
    if (this.heartbeatTimer) return;
    this.onMessageCallback = onMessage;
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.check();
      } catch (e) {}
    }, intervalSeconds * 1000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _handleActiveMessage(msg) {
    if (msg && msg.title) {
      if (this.onMessageCallback) {
        this.onMessageCallback(msg);
      } else {
        console.log(`[LIVE IN-APP BROADCAST] ${msg.title}: ${msg.content}`);
      }
      if (msg.type === 'killswitch') {
        console.error('[!] REMOTE KILLSWITCH TRIGGERED BY DEVELOPER.');
        if (typeof process !== 'undefined') process.exit(0);
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HSAuth;
}
if (typeof window !== 'undefined') {
  window.HSAuth = HSAuth;
}
