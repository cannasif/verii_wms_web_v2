import type {GridPage,GridRequest} from '@/components/shared/AdvancedDataGrid';
import type {
  SteelImportRequest,
  SteelLineRow,
} from './types/steel-receipt.types';

export type SteelLinePageFetcher=(
  request:GridRequest,
)=>Promise<GridPage<SteelLineRow>>;

export const committedResultPageSize=500;

export const createSteelImportCommitPayload=(
  importRequest:SteelImportRequest,
  idempotencyKey:string,
)=>({idempotencyKey,import:importRequest});

export async function fetchCommittedPlanLines(
  planId:number,
  lineCount:number,
  fetchPage:SteelLinePageFetcher,
):Promise<SteelLineRow[]> {
  const result:SteelLineRow[]=[];
  const expectedPages=Math.max(1,Math.ceil(lineCount/committedResultPageSize));
  for(let pageNumber=1;pageNumber<=expectedPages;pageNumber++){
    const page=await fetchPage({
      pageNumber,
      pageSize:committedResultPageSize,
      search:null,
      filterLogic:'and',
      filters:[{column:'planId',operator:'equals',value:String(planId)}],
      sortBy:'lineNo',
      sortDirection:'asc',
    });
    result.push(...page.items);
    if(!page.hasNextPage&&result.length>=page.totalCount)break;
  }
  return result;
}
