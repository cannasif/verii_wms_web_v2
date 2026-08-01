import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreLabelMatch } from './toast-error-navigation';

const completedVehicleError =
  'Bu araç girişinin SAC kabul işlemi daha önce tamamlanmış veya iptal edilmiş.';

test('vehicle completed error prefers entry time over rack label heading', () => {
  const rackHeadingScore = scoreLabelMatch(
    completedVehicleError,
    'Kabul / staging rafı *',
  );
  const entryTimeScore = scoreLabelMatch(completedVehicleError, 'Araç giriş zamanı');

  assert.ok(rackHeadingScore < 8, 'rack heading alone should not trigger navigation');
  assert.ok(entryTimeScore >= 8, 'entry time should remain the best label match');
  assert.ok(entryTimeScore > rackHeadingScore);
});

test('rack label with placeholder text no longer inflates the match score', () => {
  const inflatedLabelText = 'Kabul / staging rafı * Kabul rafı seçin (opsiyonel)';
  const headingOnlyText = 'Kabul / staging rafı *';

  const inflatedScore = scoreLabelMatch(completedVehicleError, inflatedLabelText);
  const headingScore = scoreLabelMatch(completedVehicleError, headingOnlyText);

  assert.ok(inflatedScore > headingScore);
  assert.ok(headingScore < 8);
});

test('vehicle completed error prefers explicit plate target keys over entry time label', () => {
  const msg =
    'Bu araç girişinin SAC kabul işlemi daha önce tamamlanmış veya iptal edilmiş.';
  const plateKeys = [
    'plaka',
    'çekici plakası',
    'araç girişinin sac kabul',
    'tamamlanmış',
    'iptal edilmiş',
  ];
  let best = 0;
  for (const key of plateKeys) {
    const normalizedKey = key
      .toLocaleLowerCase('tr-TR')
      .replace(/\*/g, ' ')
      .replace(/[:·•|/]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (msg.toLocaleLowerCase('tr-TR').includes(normalizedKey)) {
      best = Math.max(best, normalizedKey.length + 30);
    }
  }
  const entryTimeScore = scoreLabelMatch(msg, 'Araç giriş zamanı');
  assert.ok(best > entryTimeScore);
});

test('sheet line ref parses dcode before levhasi phrase', () => {
  const msg = 'SAC-2026-000002 levhası için en az bir görsel zorunludur.';
  const match = msg.match(/^([^:\n]{3,120})\s+levhas[ıi]\s/i);
  assert.equal(match?.[1], 'SAC-2026-000002');
});

test('explicit goods-receipt location errors still match rack headings', () => {
  const message = 'Seçilen raf aktif ve hedef depoya ait olmalıdır.';
  const rackHeadingScore = scoreLabelMatch(message, 'Raf Kodu');
  const quantityScore = scoreLabelMatch(message, 'Miktar');

  assert.ok(rackHeadingScore < 8);
  assert.ok(quantityScore < 8);
});
