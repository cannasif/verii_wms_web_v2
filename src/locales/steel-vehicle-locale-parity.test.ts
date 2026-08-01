import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const languages=['tr','en','de','es','fr','it','ar'] as const;

const requiredKeys=[
  'vehicleCheckIn.action.addUnknownPlate',
  'vehicleCheckIn.action.removeUnknownPlate',
  'vehicleCheckIn.action.resolveUnknownPlate',
  'vehicleCheckIn.action.saveVehicle',
  'vehicleCheckIn.action.captureSheetImage',
  'vehicleCheckIn.action.captureVehicleImage',
  'vehicleCheckIn.blocker.unknownPlatesPending',
  'vehicleCheckIn.carrierLookup.empty',
  'vehicleCheckIn.carrierLookup.searchPlaceholder',
  'vehicleCheckIn.carrierLookup.title',
  'vehicleCheckIn.confirm.removeUnknownDescription',
  'vehicleCheckIn.confirm.removeUnknownTitle',
  'vehicleCheckIn.section.unknownPlates',
  'vehicleCheckIn.saveVehicleBlockers.title',
  'vehicleCheckIn.toast.noChangesToSave',
  'vehicleCheckIn.toast.noNewSheetsSelected',
  'vehicleCheckIn.toast.resolveUnknownPlateFailed',
  'vehicleCheckIn.toast.saveVehicleFailed',
  'vehicleCheckIn.toast.sheetAlreadyAccepted',
  'vehicleCheckIn.toast.sheetCountBelowSaved',
  'vehicleCheckIn.toast.unknownPlateResolved',
  'vehicleCheckIn.toast.vehicleSaved',
  'vehicleCheckIn.unknownBadge',
  'vehicleCheckIn.unknownSlotDescription',
  'vehicleCheckIn.unknownSequence',
  'vehicleCheckIn.unknownAwaitingMatch',
  'vehicleCheckIn.resolveModeHint',
  'vehicleCheckIn.resolveUnavailable',
  'steelGoodReceiptAcceptance.importTransfer.commitResultLoadFailed',
  'steelGoodReceiptAcceptance.importTransfer.gibWaybillNo',
  'steelGoodReceiptAcceptance.importTransfer.validationFieldRequired',
  'steelGoodReceiptAcceptance.importTransfer.validationFieldsRequired',
  'steelGoodReceiptAcceptance.importTransfer.validationWaybill',
] as const;

const get=(root:Record<string,unknown>,path:string):unknown=>
  path.split('.').reduce<unknown>((value,key)=>
    value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined,root);

test('steel vehicle locale JSON parses and feature keys stay in parity',async()=>{
  const scopes=await Promise.all(languages.map(async language=>({
    language,
    json:JSON.parse(await readFile(
      new URL(`./${language}/common.json`,import.meta.url),'utf8')) as Record<string,unknown>,
  })));
  const mismatches=scopes.flatMap(scope=>{
    const missing=requiredKeys.filter(key=>{
      const value=get(scope.json,key);
      return typeof value!=='string'||value.trim()===''||value===key;
    });
    return missing.length?[`${scope.language} missing: ${missing.join(', ')}`]:[];
  });
  assert.deepEqual(mismatches,[]);
});
