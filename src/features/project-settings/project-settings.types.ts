export interface ProjectSettings {
  id:number; numberLocale:string; decimalPlaces:number; dateFormat:string; timeFormat:string;
  yearFormat:string; timeZoneId:string; createdBy?:number; createdDate?:string; updatedBy?:number; updatedDate?:string;
}
export type UpdateProjectSettings = Pick<ProjectSettings,'numberLocale'|'decimalPlaces'|'dateFormat'|'timeFormat'|'yearFormat'|'timeZoneId'>;
