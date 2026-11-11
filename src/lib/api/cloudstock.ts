import {getAccessToken} from '@/lib/auth/client';
const BASE=(process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api').replace(/\/$/,'');
export interface ApiProduct {id:string;name:string;name_en:string|null;sku:string;category_id:string;unit_id:string;category_name:string;category_name_en:string|null;unit_symbol:string;unit_symbol_en:string|null;cost_price:string|number;stock_quantity:number;minimum_stock:number}
export interface ApiCategory {id:string;name:string;name_en:string|null}
export interface ApiUnit {id:string;name:string;name_en:string|null;symbol:string;symbol_en:string|null}
export interface ApiMovement {id:string;sku:string;type:'IN'|'OUT';quantity:number;performed_by:string;actor_role?:'admin'|'staff'|'viewer'|null;actor_name?:string|null;created_at:string;note:string|null}
export interface ApiDashboard {summary:{total_products:number;total_units:number;inventory_value:string;low_stock:number;out_of_stock:number};history:{day:string;type:'IN'|'OUT';quantity:number}[]}
export async function apiRequest<T=unknown>(path:string,init:RequestInit={}):Promise<T>{
 const token=await getAccessToken();
 if(!token)throw new Error('Your session has expired. Please sign in again.');
 const response=await fetch(`${BASE}${path}`,{...init,cache:'no-store',headers:{'Content-Type':'application/json',...init.headers,Authorization:`Bearer ${token}`}});
 if(!response.ok){
  const payload=await response.json().catch(()=>({}));
  const raw=payload.message;
  const message=Array.isArray(raw)?raw.join(', '):typeof raw==='string'?raw:`Request failed (${response.status})`;
  throw new Error(message);
 }
 if(response.status===204)return undefined as T;
 return response.json() as Promise<T>;
}

export type ReportPeriod='day'|'week'|'month';
export interface TrendResponse{period:ReportPeriod;timezone:string;points:{period:string;inbound:string|number;outbound:string|number}[]}
export interface LowStockItem{id:string;sku:string;name:string;name_en:string|null;stock_quantity:number;minimum_stock:number;shortage:number;status:'OUT'|'LOW'}
export async function downloadReportCsv(kind:'inventory'|'low-stock'|'movements'){
 const token=await getAccessToken();
 if(!token)throw new Error('Your session has expired. Please sign in again.');
 const response=await fetch(`${BASE}/reports/export?kind=${encodeURIComponent(kind)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
 if(!response.ok){
  const payload=await response.json().catch(()=>({}));
  throw new Error(Array.isArray(payload.message)?payload.message.join(', '):payload.message||'Unable to export report');
 }
 const blob=await response.blob();const href=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=href;
 anchor.download=`cloudstock-${kind}-${new Date().toISOString().slice(0,10)}.csv`;
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(href),2000);
}
