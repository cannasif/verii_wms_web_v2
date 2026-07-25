import { api } from '@/lib/axios';
import type { ProjectSettings,UpdateProjectSettings } from './project-settings.types';
interface Envelope<T>{success:boolean;data:T;message?:string}
const unwrap=<T>(response:Envelope<T>):T=>{if(!response.success)throw new Error(response.message||'İşlem başarısız.');return response.data;};
export const projectSettingsApi={
  current:async():Promise<ProjectSettings>=>unwrap(await api.get<Envelope<ProjectSettings>>('/api/project-settings/current')),
  get:async():Promise<ProjectSettings>=>unwrap(await api.get<Envelope<ProjectSettings>>('/api/project-settings')),
  update:async(request:UpdateProjectSettings):Promise<ProjectSettings>=>unwrap(await api.put<Envelope<ProjectSettings>>('/api/project-settings',request,{useNativeHttpMethod:true})),
};
