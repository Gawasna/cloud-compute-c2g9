'use client';
import {useEffect,useState} from 'react';
import MovementChart from '@/components/MovementChart';
import {apiRequest,downloadReportCsv,type LowStockItem,type ApiDashboard} from '@/lib/api/cloudstock';
const money=(v:number)=>new Intl.NumberFormat('vi-VN').format(v)+' ₫';
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
   .catch(e=>{if(active)setError(e instanceof Error?e.message:'Không tải được báo cáo')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[]);
 const download=async(kind:'inventory'|'low-stock'|'movements')=>{
  setDownloading(kind);setError('');
  try{await downloadReportCsv(kind)}catch(e){setError(e instanceof Error?e.message:'Không thể xuất CSV')}
  finally{setDownloading(null)}
 };
 return <>
  <div className="panel-head report-header"><div><h2>Báo cáo tồn kho</h2><p>Dữ liệu được tính trên toàn bộ sản phẩm từ PostgreSQL, không giới hạn 100 dòng.</p></div>
   <div className="report-actions"><button type="button" className="btn secondary" disabled={!!downloading} onClick={()=>void download('inventory')}>↓ CSV tồn kho</button><button type="button" className="btn secondary" disabled={!!downloading} onClick={()=>void download('movements')}>↓ CSV giao dịch</button></div>
  </div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="metrics report-metrics">
   <div className="metric"><span>Giá trị hàng tồn (theo giá vốn)</span><b className="value-text">{loading?'...':money(Number(summary?.inventory_value||0))}</b><small>Không phải doanh thu hay Cash Flow</small></div>
   <div className="metric"><span>Sắp hết hàng</span><b>{loading?'...':summary?.low_stock??0}</b><small>Còn hàng nhưng dưới ngưỡng tối thiểu</small></div>
   <div className="metric"><span>Đã hết hàng</span><b>{loading?'...':summary?.out_of_stock??0}</b><small>Tồn kho bằng 0</small></div>
  </div>
  <MovementChart title="Biểu đồ nhập / xuất theo kỳ"/>
  <section className="panel"><div className="panel-head"><div><h2>Sản phẩm cần bổ sung</h2><p>Bao gồm sản phẩm hết hàng và sắp hết theo định mức</p></div><button type="button" className="btn secondary" disabled={!!downloading} onClick={()=>void download('low-stock')}>↓ CSV cảnh báo</button></div>
   <div className="table-scroll"><table><thead><tr><th>Mã SKU</th><th>Tên sản phẩm</th><th>Tồn kho</th><th>Ngưỡng</th><th>Cần bổ sung</th><th>Trạng thái</th></tr></thead><tbody>
    {alerts.map(p=><tr key={p.id}><td className="mono">{p.sku}</td><td>{p.name}</td><td>{p.stock_quantity}</td><td>{p.minimum_stock}</td><td>{p.shortage}</td><td><span className={'tag '+(p.status==='OUT'?'danger':'warning')}>{p.status==='OUT'?'Hết hàng':'Sắp hết'}</span></td></tr>)}
    {!loading&&!alerts.length&&<tr><td colSpan={6} className="empty">Không có sản phẩm cần cảnh báo.</td></tr>}
   </tbody></table></div>
  </section>
 </>;
}
