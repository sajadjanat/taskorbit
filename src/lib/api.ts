export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export async function api<T=unknown>(url:string,method='GET',body?:unknown):Promise<T>{
 let r:Response;try{r=await fetch('/api'+url,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}catch{throw new ApiError(0,'Cannot reach server');}
 const data=await r.json();if(!r.ok)throw new ApiError(r.status,data.error||'Request failed');return data;
}
export type User={id:string;name:string;email:string;admin:number;active:number;role?:string};
export type Workspace={id:string;name:string;role:string};
export type Project={id:string;workspace_id:string;name:string;identifier:string;description:string;color:string;archived:number};
export type Task={id:string;project_id:string;number:number;title:string;description:string;status:string;priority:string;assignee_id:string|null;sprint_id:string|null;module_id:string|null;parent_id:string|null;labels:string[];due_date:string|null;estimate:number;version:number;created_at:string};
export type Sprint={id:string;name:string;goal:string;start_date:string;end_date:string;status:string;project_id:string};
export type Module={id:string;name:string;description:string};
export type Page={id:string;title:string;body:string;version:number};
export type Filters={q:string;status:string;priority:string;assignee_id:string;sprint_id:string};
export type View={id:string;name:string;filters:Filters};
export type Activity={id:number;name:string;action:string;detail:string;created_at:string;task_id:string};
export type Comment={id:string;name:string;body:string;created_at:string};
