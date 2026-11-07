import {authedFetch} from '@/lib/auth/client';
// Cookie-based sessions only work same-origin, so the API base is always the relative /api.
const BASE = '/api';
export interface ApiProduct {id:string;name:string;sku:string;category_id:string;unit_id:string;category_name:string;unit_symbol:string;cost_price:string|number;stock_quantity:number;minimum_stock:number}
export interface ApiCategory {id:string;name:string}
export interface ApiUnit {id:string;name:string;symbol:string}
export interface ApiMovement {id:string;sku:string;type:'IN'|'OUT';quantity:number;performed_by:string;actor_role?:'admin'|'staff'|'viewer'|null;actor_name?:string|null;created_at:string;note:string|null}
export interface ApiDashboard {summary:{total_products:number;total_units:number;inventory_value:string;low_stock:number;out_of_stock:number};history:{day:string;type:'IN'|'OUT';quantity:number}[]}
export async function apiRequest<T=unknown>(path:string,init:RequestInit={}):Promise<T>{
 const response=await authedFetch(`${BASE}${path}`,{...init,headers:{'Content-Type':'application/json',...init.headers}});
 if(response.status===401)throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
 if(!response.ok){
  const payload=await response.json().catch(()=>({}));
  const raw=payload.message;
  const message=Array.isArray(raw)?raw.join(', '):typeof raw==='string'?raw:`Không thể hoàn tất yêu cầu (${response.status})`;
  throw new Error(message);
 }
 if(response.status===204)return undefined as T;
 return response.json() as Promise<T>;
}

export type ReportPeriod='day'|'week'|'month';
export interface TrendResponse{period:ReportPeriod;timezone:string;points:{period:string;inbound:string|number;outbound:string|number}[]}
export interface LowStockItem{id:string;sku:string;name:string;stock_quantity:number;minimum_stock:number;shortage:number;status:'OUT'|'LOW'}
export async function downloadReportCsv(kind:'inventory'|'low-stock'|'movements'){
 const response=await authedFetch(`${BASE}/reports/export?kind=${encodeURIComponent(kind)}`);
 if(response.status===401)throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
 if(!response.ok){
  const payload=await response.json().catch(()=>({}));
  throw new Error(Array.isArray(payload.message)?payload.message.join(', '):payload.message||'Không thể xuất báo cáo');
 }
 const blob=await response.blob();const href=URL.createObjectURL(blob);
 const anchor=document.createElement('a');anchor.href=href;
 anchor.download=`cloudstock-${kind}-${new Date().toISOString().slice(0,10)}.csv`;
 document.body.appendChild(anchor);anchor.click();anchor.remove();
 window.setTimeout(()=>URL.revokeObjectURL(href),2000);
}
