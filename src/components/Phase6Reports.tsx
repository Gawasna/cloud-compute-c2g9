'use client';
import {useEffect,useState} from 'react';
import MovementChart from '@/components/MovementChart';
import {apiRequest,downloadReportCsv,type LowStockItem,type ApiDashboard} from '@/lib/api/cloudstock';
const money=(v:number)=>new Intl.NumberFormat('en-US').format(v)+' ₫';
type Summary=ApiDashboard['summary'];
export default function Phase6Reports(){
 const [summary,setSummary]=useState<Summary|null>(null);
 const [alerts,setAlerts]=useState<LowStockItem[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [downloading,setDownloading]=useState<string|null>(null);
 useEffect(()=>{
  let active=true;
  void Promise.all([apiRequest<Summary>('/reports/overview'),apiRequest<LowStockItem[]>('/reports/low-stock')])
   .then(([s,a])=>{if(active){setSummary(s);setAlerts(a)}})
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load reports')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const download=async(kind:'inventory'|'low-stock'|'movements')=>{
  setDownloading(kind);setError('');
  try{await downloadReportCsv(kind)}catch(e){setError(e instanceof Error?e.message:'Unable to export CSV')}
  finally{setDownloading(null)}
 };
 return <>
  <div className="panel-head report-header"><div><h2>Inventory Reports</h2><p>Calculated from all products in PostgreSQL; not limited to 100 records.</p></div>
   <div className="report-actions"><button type="button" className="btn secondary" disabled={!!downloading} onClick={()=>void download('inventory')}>↓ Inventory CSV</button><button type="button" className="btn secondary" disabled={!!downloading} onClick={()=>void download('movements')}>↓ Movements CSV</button></div>
  </div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="metrics report-metrics">
   <div className="metric"><span>Inventory Value (at Cost)</span><b className="value-text">{loading?'...':money(Number(summary?.inventory_value||0))}</b><small>Not revenue or cash flow</small></div>
   <div className="metric"><span>Low Stock</span><b>{loading?'...':summary?.low_stock??0}</b><small>In stock but below minimum threshold</small></div>
   <div className="metric"><span>Out of Stock</span><b>{loading?'...':summary?.out_of_stock??0}</b><small>Zero stock</small></div>
  </div>
  <MovementChart title="Stock In / Out by Period"/>
  <section className="panel"><div className="panel-head"><div><h2>Products to Replenish</h2><p>Includes low-stock and out-of-stock products</p></div><button type="button" className="btn secondary" disabled={!!downloading} onClick={()=>void download('low-stock')}>↓ Low Stock CSV</button></div>
   <div className="table-scroll"><table><thead><tr><th>SKU</th><th>Product Name</th><th>Stock</th><th>Minimum</th><th>Shortage</th><th>Status</th></tr></thead><tbody>
    {alerts.map(p=><tr key={p.id}><td className="mono">{p.sku}</td><td>{p.name_en?.trim()||p.name}</td><td>{p.stock_quantity}</td><td>{p.minimum_stock}</td><td>{p.shortage}</td><td><span className={'tag '+(p.status==='OUT'?'danger':'warning')}>{p.status==='OUT'?'Out of Stock':'Low Stock'}</span></td></tr>)}
    {!loading&&!alerts.length&&<tr><td colSpan={6} className="empty">No products require replenishment.</td></tr>}
   </tbody></table></div>
  </section>
 </>;
}
