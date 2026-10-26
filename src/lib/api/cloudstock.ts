import {getAccessToken} from '@/lib/auth/client';
const rawBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const BASE = (rawBase && !rawBase.includes(':4000')) ? rawBase : '/api';
export interface ApiProduct {id:string;name:string;sku:string;category_id:string;unit_id:string;category_name:string;unit_symbol:string;cost_price:string|number;stock_quantity:number;minimum_stock:number}
export interface ApiCategory {id:string;name:string}
export interface ApiUnit {id:string;name:string;symbol:string}
export interface ApiMovement {id:string;sku:string;type:'IN'|'OUT';quantity:number;performed_by:string;actor_role?:'admin'|'staff'|'viewer'|null;actor_name?:string|null;created_at:string;note:string|null}
export interface ApiDashboard {summary:{total_products:number;total_units:number;inventory_value:string;low_stock:number;out_of_stock:number};history:{day:string;type:'IN'|'OUT';quantity:number}[]}
export async function apiRequest<T=unknown>(path:string,init:RequestInit={}):Promise<T>{
 const token=await getAccessToken();
 if(!token)throw new Error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
 const response=await fetch(`${BASE}${path}`,{...init,cache:'no-store',headers:{'Content-Type':'application/json',...init.headers,Authorization:`Bearer ${token}`}});
 if(!response.ok){
  const payload=await response.json().catch(()=>({}));
  const raw=payload.message;
  const message=Array.isArray(raw)?raw.join(', '):typeof raw==='string'?raw:`Không thể hoàn tất yêu cầu (${response.status})`;
  throw new Error(message);
 }
 if(response.status===204)return undefined as T;
 return response.json() as Promise<T>;
}
