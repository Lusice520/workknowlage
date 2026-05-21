const { initDatabase, closeDatabase } = require('../electron/db/index.cjs');
const spacesRepo = require('../electron/db/repositories/spaces.cjs');
const documentsRepo = require('../electron/db/repositories/documents.cjs');
const sharesRepo = require('../electron/share/repository.cjs');

async function runSmoke() {
  initDatabase();

  const space = spacesRepo.createSpace({ name: 'Share Repository Space', label: 'WORKSPACE' });
  const document = documentsRepo.createDocument({
    spaceId: space.id,
    folderId: null,
    title: 'Public Share Smoke Document',
  });

  const localShare = sharesRepo.createShare(document.id);
  const publicShare = sharesRepo.createPublicShare(document.id, {
    expiresAt: '2026-05-22 09:30:00',
  });
  const tokenLookup = sharesRepo.getPublicShareByToken(publicShare.publicToken);
  const validPassword = sharesRepo.verifyPublicSharePassword(publicShare.publicToken, publicShare.publicPassword);
  const invalidPassword = sharesRepo.verifyPublicSharePassword(publicShare.publicToken, 'definitely-wrong');
  const refreshedLocalShare = sharesRepo.getShareByDocumentId(document.id);
  const listedShares = sharesRepo.listSharesForSpace(space.id);
  const disabledPublicShare = sharesRepo.disablePublicShare(document.id);
  const disabledAllCount = sharesRepo.disableSharesForSpace(space.id);
  const sharesAfterDisableAll = sharesRepo.listSharesForSpace(space.id);

  closeDatabase();
  console.log(JSON.stringify({
    ok: true,
    documentId: document.id,
    localToken: localShare.token,
    refreshedLocalToken: refreshedLocalShare.token,
    publicToken: publicShare.publicToken,
    hasPublicPassword: typeof publicShare.publicPassword === 'string' && publicShare.publicPassword.length >= 12,
    publicEnabled: publicShare.publicEnabled,
    publicExpiresAt: publicShare.publicExpiresAt,
    tokenLookupDocumentId: tokenLookup?.documentId ?? null,
    validPassword,
    invalidPassword,
    listedSharesCount: listedShares.length,
    listedDocumentTitle: listedShares[0]?.documentTitle ?? null,
    disabledPublicEnabled: disabledPublicShare.publicEnabled,
    disabledAllCount,
    sharesAfterDisableAllCount: sharesAfterDisableAll.length,
  }));
}

Promise.resolve()
  .then(runSmoke)
  .catch((error) => {
    console.error('[Smoke] Electron share repository smoke failed:', error);
    process.exitCode = 1;
  });
