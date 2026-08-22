import type {GridFilter} from '@/components/shared/AdvancedDataGrid';

export function canEnableUnknownPlateResolve(
  serverCanResolve: boolean,
  busy: boolean,
): boolean {
  return serverCanResolve && !busy;
}

export function collectKnownPlateExcelReferences(
  plates: Array<{identityStatus?:string|null;importReferenceNo?:string|null}>,
): string[] {
  const refs:string[]=[];
  const seen=new Set<string>();
  for(const plate of plates){
    if(plate.identityStatus==='Unknown')continue;
    const ref=plate.importReferenceNo?.trim();
    if(!ref||seen.has(ref))continue;
    seen.add(ref);
    refs.push(ref);
  }
  return refs;
}

export function buildKnownPlateExcelCandidateFilters(excelReferences:readonly string[]):GridFilter[]{
  return excelReferences.map(value=>({column:'importReferenceNo',operator:'equals',value}));
}

export function matchesKnownPlateExcel(
  importReferenceNo:string|null|undefined,
  excelReferences:readonly string[],
):boolean{
  if(excelReferences.length===0)return true;
  const ref=importReferenceNo?.trim();
  return Boolean(ref&&excelReferences.includes(ref));
}
