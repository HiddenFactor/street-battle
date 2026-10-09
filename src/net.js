// =====================================================================
// net.js – Verbindung zwischen zwei Browsern über PeerJS (WebRTC)
// ---------------------------------------------------------------------
// PeerJS vermittelt über einen kostenlosen Server die DIREKTE Verbindung
// zwischen euren Geräten (Peer-to-Peer). Danach laufen die Daten direkt.
// Die Bibliothek wird erst geladen, wenn jemand "Online" öffnet.
// =====================================================================

import { NET } from './config.js';

// Ohne leicht verwechselbare Zeichen (kein I, O, 0, 1)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = new RegExp(`^[${CODE_CHARS}]+$`);

/** Zufälliger Code (Raum-Code oder – länger – fester Lobby-Code) */
export function makeRoomCode(length = NET.CODE_LENGTH) {
  let code = '';
  for (let i = 0; i < length; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return code;
}

export function cleanCode(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidCode(code) {
  return (code.length === NET.CODE_LENGTH || code.length === NET.LOBBY_CODE_LENGTH) && CODE_PATTERN.test(code);
}

// Fehlermeldungen auf Deutsch: [Überschrift, Text]
export const ERRORS = {
  load: ['Online-Modul fehlt', 'PeerJS konnte nicht geladen werden.\nBist du mit dem Internet verbunden? Lokal und Training funktionieren trotzdem.'],
  server: ['Server nicht erreichbar', 'Der Vermittlungsserver ist gerade nicht erreichbar.\nBitte Internetverbindung prüfen und es gleich nochmal versuchen.'],
  notFound: ['Raum nicht gefunden', 'Zu diesem Code gibt es keinen offenen Raum.\nStimmt der Code? Der andere Spieler muss den Raum offen lassen, bis du beitrittst.'],
  p2p: [
    'Verbindung fehlgeschlagen',
    'Die direkte Verbindung zwischen euren Geräten kam nicht zustande.\n\nHäufige Ursache: Manche Mobilfunknetze sowie Firmen- oder Schul-WLANs blockieren Peer-to-Peer-Verbindungen. Probiert es im Heim-WLAN oder über einen Handy-Hotspot – oder tauscht, wer den Raum erstellt.',
  ],
  browser: ['Browser zu alt', 'Dein Browser unterstützt keine Direktverbindungen (WebRTC).\nBitte einen aktuellen Chrome, Firefox, Edge oder Safari benutzen.'],
  lost: ['Verbindung verloren', 'Vom Gegner kommt nichts mehr an – vielleicht ist sein Internet weg oder das Spiel wurde geschlossen.\n\nTipp: Mobilfunk bricht öfter ab, WLAN ist stabiler.'],
  left: ['Gegner weg', 'Dein Gegner hat das Spiel verlassen.'],
  closed: ['Verbindung getrennt', 'Die Verbindung zum Gegner wurde getrennt.'],
  version: ['Verschiedene Versionen', 'Ihr habt unterschiedliche Spielversionen oder Spielwerte (config.js).\nBitte beide die Seite neu laden (F5). Wer config.js geändert hat, muss die neue Version auch dem Gegner geben.'],
  busy: ['Raum ist voll', 'In diesem Raum spielen schon zwei Leute.'],
  taken: ['Code vergeben', 'Dieser Raumcode ist gerade belegt.'],
  lobbyTaken: ['Lobby schon offen', 'Deine Lobby ist gerade schon offen – vielleicht in einem anderen Tab oder Fenster?\nSchließ es und versuch es nochmal.'],
};

function errorKey(err) {
  switch (err && err.type) {
    case 'peer-unavailable': return 'notFound';
    case 'unavailable-id': return 'taken';
    case 'browser-incompatible': return 'browser';
    case 'webrtc': return 'p2p';
    default: return 'server'; // network, server-error, socket-error, socket-closed, disconnected ...
  }
}

class NetError extends Error {
  constructor(key) {
    super(key);
    this.key = key;
  }
}

// ---------------------------------------------------------------------
// PeerJS bei Bedarf vom CDN laden (mit Ersatz-Adresse)
// ---------------------------------------------------------------------
let loading = null;
export function loadPeerJS() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const urls = [...NET.PEERJS_URLS];
    const next = () => {
      const url = urls.shift();
      if (!url) {
        loading = null;
        reject(new NetError('load'));
        return;
      }
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => (window.Peer ? resolve(window.Peer) : next());
      script.onerror = () => {
        script.remove();
        next();
      };
      document.head.appendChild(script);
    };
    next();
  });
  return loading;
}

// ---------------------------------------------------------------------
// Eine Verbindung (Host wartet, Gast verbindet sich)
// ---------------------------------------------------------------------
export class Net {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.closed = false;
    this.timer = 0;
    // Diese Funktionen setzt der Benutzer von Net:
    this.onOpen = null;   // Verbindung steht
    this.onData = null;   // Nachricht empfangen
    this.onError = null;  // (Schlüssel aus ERRORS) – Verbindung ist danach zu
  }

  peerOptions() {
    const options = { debug: 1 };
    if (NET.ICE_SERVERS) options.config = { iceServers: NET.ICE_SERVERS };
    return options;
  }

  /** Raum erstellen. Erfüllt sich, sobald der Raum beim Server angemeldet ist. */
  async host(code) {
    await loadPeerJS();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(NET.ID_PREFIX + code.toLowerCase(), this.peerOptions());
      this.peer = peer;
      let registered = false;
      peer.on('open', () => {
        registered = true;
        resolve(code);
      });
      peer.on('connection', (conn) => {
        if (this.conn) {
          // Schon ein Gegner da: höflich ablehnen
          conn.on('open', () => {
            conn.send({ t: 'busy' });
            setTimeout(() => conn.close(), 500);
          });
          return;
        }
        this.attach(conn);
      });
      peer.on('disconnected', () => {
        // Verbindung zum Vermittlungsserver weg – solange noch niemand da ist, neu verbinden
        if (!this.conn && !this.closed) {
          try {
            peer.reconnect();
          } catch {
            /* egal */
          }
        }
      });
      peer.on('error', (err) => {
        if (!registered) reject(new NetError(errorKey(err)));
        else if (!this.conn) this.fail(errorKey(err));
      });
    });
  }

  /** Einem Raum beitreten. Erfüllt sich, sobald die Direktverbindung steht. */
  async join(code) {
    await loadPeerJS();
    return new Promise((resolve, reject) => {
      const peer = new window.Peer(this.peerOptions());
      this.peer = peer;
      this.joinResolve = resolve;
      this.joinReject = reject;
      this.timer = setTimeout(() => this.rejectJoin('p2p'), NET.CONNECT_TIMEOUT_MS);
      peer.on('open', () => {
        const conn = peer.connect(NET.ID_PREFIX + code.toLowerCase(), { reliable: false, serialization: 'json' });
        this.attach(conn);
      });
      peer.on('error', (err) => {
        if (this.joinReject) this.rejectJoin(errorKey(err));
        else this.fail(errorKey(err));
      });
    });
  }

  rejectJoin(key) {
    clearTimeout(this.timer);
    const reject = this.joinReject;
    this.joinResolve = this.joinReject = null;
    this.close();
    if (reject) reject(new NetError(key));
  }

  attach(conn) {
    conn.on('open', () => {
      clearTimeout(this.timer);
      this.conn = conn;
      // Direktverbindung endgültig gescheitert?
      const pc = conn.peerConnection;
      if (pc && pc.addEventListener) {
        pc.addEventListener('iceconnectionstatechange', () => {
          if (pc.iceConnectionState === 'failed') this.fail('p2p');
        });
      }
      if (this.joinResolve) {
        const resolve = this.joinResolve;
        this.joinResolve = this.joinReject = null;
        resolve();
      }
      if (this.onOpen) this.onOpen();
    });
    conn.on('data', (data) => {
      if (conn === this.conn && this.onData) this.onData(data);
    });
    conn.on('close', () => {
      if (conn === this.conn) this.fail('closed');
    });
    conn.on('error', () => {
      if (conn === this.conn) this.fail('p2p');
      else if (this.joinReject) this.rejectJoin('p2p');
    });
  }

  send(msg) {
    if (!this.conn || !this.conn.open) return;
    try {
      this.conn.send(msg);
    } catch {
      // Puffer voll o. Ä. – die Eingaben werden ohnehin wiederholt gesendet
    }
  }

  fail(key) {
    if (this.closed) return;
    const cb = this.onError;
    this.close();
    if (cb) cb(key);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    try {
      if (this.conn) this.conn.close();
    } catch {
      /* egal */
    }
    try {
      if (this.peer) this.peer.destroy();
    } catch {
      /* egal */
    }
    this.conn = null;
    this.peer = null;
  }
}
