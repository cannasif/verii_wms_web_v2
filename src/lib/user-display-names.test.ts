import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { buildUserDisplayNameMap, findUsersMatchingActorSearch, formatUserDisplayName } from './user-display-names';

describe('user-display-names', () => {
  it('prefers first + last name over username', () => {
    assert.equal(
      formatUserDisplayName({
        id: 8,
        username: 'mutahhar',
        firstName: 'Mutahhar',
        lastName: 'Yılmaz',
      }),
      'Mutahhar Yılmaz',
    );
  });

  it('falls back to username when name is empty', () => {
    assert.equal(
      formatUserDisplayName({
        id: 8,
        username: 'mutahhar',
        firstName: '  ',
        lastName: '',
      }),
      'mutahhar',
    );
  });

  it('builds an id → label map', () => {
    const map = buildUserDisplayNameMap([
      { id: 8, firstName: 'Ali', lastName: 'Veli', username: 'ali' },
      { id: 9, firstName: '', lastName: '', username: 'sistemci' },
    ]);
    assert.equal(map.get(8), 'Ali Veli');
    assert.equal(map.get(9), 'sistemci');
  });

  it('resolves visible actor labels to user ids', () => {
    const users = [
      { id: 8, firstName: 'Mutahhar', lastName: 'Yılmaz', username: 'mutahhar' },
      { id: 9, firstName: 'Ali', lastName: 'Veli', username: 'ali' },
    ];
    const labels = {
      systemActor: 'Sistem',
      userNumber: (id: number) => `Kullanıcı #${id}`,
    };

    assert.deepEqual(
      findUsersMatchingActorSearch('mutahhar yilmaz', users, labels),
      { userIds: [8], includeSystem: false },
    );
    assert.deepEqual(
      findUsersMatchingActorSearch('ali', users, labels),
      { userIds: [9], includeSystem: false },
    );
    assert.deepEqual(
      findUsersMatchingActorSearch('Sistem', users, labels),
      { userIds: [], includeSystem: true },
    );
    assert.deepEqual(
      findUsersMatchingActorSearch('Kullanıcı #8', users, labels),
      { userIds: [8], includeSystem: false },
    );
  });
});
