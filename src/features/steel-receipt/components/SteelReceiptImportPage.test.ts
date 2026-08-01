import assert from 'node:assert/strict';
import test from 'node:test';
import type {GridPage,GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {SteelLineRow} from '../types/steel-receipt.types';
import type {SteelImportRequest} from '../types/steel-receipt.types';
import {
  createSteelImportCommitPayload,
  fetchCommittedPlanLines,
} from '../steel-import-result';

const line=(id:number)=>({id,lineNo:id} as SteelLineRow);

const scenario=async(count:number)=>{
  const requests:GridRequest[]=[];
  const fetchPage=async(request:GridRequest):Promise<GridPage<SteelLineRow>>=>{
    requests.push(request);
    const pageNumber=request.pageNumber??1;
    const pageSize=request.pageSize??500;
    const start=(pageNumber-1)*pageSize;
    const size=Math.max(0,Math.min(pageSize,count-start));
    return {
      items:Array.from({length:size},(_,index)=>line(start+index+1)),
      pageNumber,
      pageSize,
      totalCount:count,
      totalPages:Math.ceil(count/pageSize),
      hasPreviousPage:pageNumber>1,
      hasNextPage:start+size<count,
    };
  };
  const result=await fetchCommittedPlanLines(42,count,fetchPage);
  return {requests,result};
};

test('loads 501 committed rows without exceeding API page limit',async()=>{
  const {requests,result}=await scenario(501);
  assert.equal(result.length,501);
  assert.deepEqual(requests.map(x=>x.pageSize),[500,500]);
});

test('loads 5000 committed rows in bounded pages',async()=>{
  const {requests,result}=await scenario(5000);
  assert.equal(result.length,5000);
  assert.equal(requests.length,10);
  assert.ok(requests.every(x=>x.pageSize===500));
});

test('import retry preserves the caller-owned idempotency key',()=>{
  const request={branchCode:'0'} as SteelImportRequest;
  const key='8ba73946-d42f-4dcc-8630-928e90e06c43';
  assert.deepEqual(
    createSteelImportCommitPayload(request,key),
    createSteelImportCommitPayload(request,key),
  );
});
