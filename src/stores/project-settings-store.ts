import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ProjectSettings } from '@/features/project-settings/project-settings.types';

export const DEFAULT_PROJECT_SETTINGS:ProjectSettings={id:0,numberLocale:'tr-TR',decimalPlaces:2,dateFormat:'dd.MM.yyyy',timeFormat:'HH:mm',yearFormat:'yyyy',timeZoneId:'Europe/Istanbul'};
const locales=new Set(['tr-TR','en-US','de-DE']); const dates=new Set(['dd.MM.yyyy','MM/dd/yyyy','yyyy-MM-dd']);
const times=new Set(['HH:mm','HH:mm:ss','hh:mm a','hh:mm:ss a']); const years=new Set(['yyyy','yy']);
const zones=new Set(['Europe/Istanbul','UTC','Europe/Berlin','America/New_York']);
export function normalizeProjectSettings(value?:Partial<ProjectSettings>|null):ProjectSettings{return{
  ...DEFAULT_PROJECT_SETTINGS,...value,
  numberLocale:locales.has(value?.numberLocale??'')?value!.numberLocale!:DEFAULT_PROJECT_SETTINGS.numberLocale,
  decimalPlaces:Number.isInteger(value?.decimalPlaces)?Math.min(6,Math.max(0,value!.decimalPlaces!)):2,
  dateFormat:dates.has(value?.dateFormat??'')?value!.dateFormat!:DEFAULT_PROJECT_SETTINGS.dateFormat,
  timeFormat:times.has(value?.timeFormat??'')?value!.timeFormat!:DEFAULT_PROJECT_SETTINGS.timeFormat,
  yearFormat:years.has(value?.yearFormat??'')?value!.yearFormat!:DEFAULT_PROJECT_SETTINGS.yearFormat,
  timeZoneId:zones.has(value?.timeZoneId??'')?value!.timeZoneId!:DEFAULT_PROJECT_SETTINGS.timeZoneId,
};}
interface State{settings:ProjectSettings;hasLoaded:boolean;setSettings:(value:ProjectSettings)=>void}
export const useProjectSettingsStore=create<State>()(persist(set=>({settings:DEFAULT_PROJECT_SETTINGS,hasLoaded:false,setSettings:value=>set({settings:normalizeProjectSettings(value),hasLoaded:true})}),{name:'wms-project-settings'}));
