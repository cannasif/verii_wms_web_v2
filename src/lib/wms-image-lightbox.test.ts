import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  getNextLightboxFocusIndex,
  preventDialogEscapeIfImageLightbox,
  shouldIgnoreDialogClose,
} from './wms-image-lightbox';

test('focus traversal wraps in both directions inside lightbox',()=>{
  assert.equal(getNextLightboxFocusIndex(0,3,false),1);
  assert.equal(getNextLightboxFocusIndex(2,3,false),0);
  assert.equal(getNextLightboxFocusIndex(0,3,true),2);
  assert.equal(getNextLightboxFocusIndex(1,3,true),0);
});

test('open lightbox prevents parent Radix escape and close',()=>{
  const previousDocument=globalThis.document;
  Object.defineProperty(globalThis,'document',{
    configurable:true,
    value:{querySelector:()=>({})},
  });
  try{
    let prevented=false;
    preventDialogEscapeIfImageLightbox({preventDefault:()=>{prevented=true}});
    assert.equal(prevented,true);
    assert.equal(shouldIgnoreDialogClose(),true);
  }finally{
    Object.defineProperty(globalThis,'document',{
      configurable:true,
      value:previousDocument,
    });
  }
});
