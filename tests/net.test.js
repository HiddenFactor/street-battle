// =====================================================================
// tests/net.test.js – Raum- und Lobby-Codes
// ---------------------------------------------------------------------
// Starten:  node tests/net.test.js     (oder: npm test)
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRoomCode, isValidCode, cleanCode } from '../src/net.js';
import { NET } from '../src/config.js';

test('Raum-Code und fester Lobby-Code haben die richtige Länge und sind gültig', () => {
  for (let i = 0; i < 200; i++) {
    const room = makeRoomCode();
    const lobby = makeRoomCode(NET.LOBBY_CODE_LENGTH);
    assert.equal(room.length, NET.CODE_LENGTH);
    assert.equal(lobby.length, NET.LOBBY_CODE_LENGTH);
    assert.ok(isValidCode(room), room);
    assert.ok(isValidCode(lobby), lobby);
    assert.ok(!/[IO01]/.test(lobby), 'verwechselbare Zeichen im Code');
  }
});

test('falsche Codes werden abgelehnt, Eingaben werden bereinigt', () => {
  assert.ok(!isValidCode('ABC'));
  assert.ok(!isValidCode('ABCDEF'));
  assert.ok(!isValidCode('ABCD1'), 'die Ziffer 1 kommt in Codes nicht vor');
  assert.equal(cleanCode(' k7q-xm '), 'K7QXM');
  assert.ok(isValidCode(cleanCode('k7qxm')));
});
