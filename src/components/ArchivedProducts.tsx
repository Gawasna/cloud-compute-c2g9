'use client';
import {useCallback,useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api/cloudstock';

type ArchivedProduct={
 id:string;name:string;name_en:string|null;sku:string;
 category_name:string;category_name_en:string|null;
 unit_symbol:string;unit_symbol_en:string|null;
 stock_quantity:number;deleted_at:string;
};
type ArchivedResponse={items:ArchivedProduct[];total:number;page:number;limit:number};

export default function ArchivedProducts({onRestored}:{onRestored:()=>Promise<void>}){
 const [search,setSearch]=useState('');
 const [query,setQuery]=useState('');
 const [page,setPage]=useState(1);
 const [data,setData]=useState<ArchivedResponse|null>(null);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [busyId,setBusyId]=useState<string|null>(null);
 const [message,setMessage]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const response=await apiRequest<ArchivedResponse>(`/products/archived?page=${page}&limit=20&search=${encodeURIComponent(query)}`);
   if(response.items.length===0 && page>1 && response.total>0){setPage(p=>p-1);}else{setData(response);}
  }catch(e){setError(e instanceof Error?e.message:'Unable to load archived products.');}
  finally{setLoading(false);}
 },[page,query]);
 useEffect(()=>{void load();},[load]);
 const restore=async(p:ArchivedProduct)=>{
  if(busyId||!window.confirm(`Restore ${p.name_en?.trim()||p.name} (${p.sku}) to active inventory?`))return;
  setBusyId(p.id);setError('');setMessage('');
  try{
   await apiRequest(`/products/${encodeURIComponent(p.id)}/restore`,{method:'PATCH'});
   await Promise.all([load(),onRestored()]);
   setMessage(`Product ${p.sku} restored successfully.`);
  }catch(e){setError(e instanceof Error?e.message:'Unable to restore product.');}
  finally{setBusyId(null);}
 };
 return <section className="panel">
  <div className="panel-head"><div><h2>Archived Products</h2><p>Products removed from the active inventory. Restore a product without losing its stock history.</p></div>
   <button className="btn secondary" onClick={()=>void load()} disabled={loading}>Refresh</button></div>
  <form className="filters" onSubmit={e=>{e.preventDefault();setPage(1);setQuery(search.trim());}}>
   <input aria-label="Search archived products" placeholder="Search by English name, original name, or SKU..." value={search} onChange={e=>setSearch(e.target.value)}/>
   <button className="btn secondary" type="submit">Search</button>
   <span className="result-count">{data?.total??0} archived</span>
  </form>
  {error&&<div role="alert" className="form-error">{error}</div>}
  {message&&<p role="status" className="hint">{message}</p>}
  {loading&&<p className="hint">Loading archived products...</p>}
  <div className="table-scroll"><table><thead><tr>
   <th>Product Name</th><th>SKU</th><th>Category</th><th>Stock</th><th>Archived At</th><th>Action</th>
  </tr></thead><tbody>
   {data?.items.map(p=><tr key={p.id}>
    <td><strong>{p.name_en?.trim()||p.name}</strong></td><td className="mono">{p.sku}</td>
    <td>{p.category_name_en?.trim()||p.category_name}</td>
    <td>{Number(p.stock_quantity).toLocaleString('en-US')} {(p.unit_symbol_en?.trim()||p.unit_symbol).toLowerCase()}</td>
    <td>{new Date(p.deleted_at).toLocaleString('en-US')}</td>
    <td><button type="button" className="small-btn" disabled={busyId!==null} onClick={()=>void restore(p)}>{busyId===p.id?'Restoring...':'Restore'}</button></td>
   </tr>)}
   {!loading&&data?.items.length===0&&<tr><td colSpan={6} className="empty">No archived products found.</td></tr>}
  </tbody></table></div>
  <div className="filters" style={{justifyContent:'flex-end',marginTop:16}}>
   <button className="small-btn" disabled={loading||page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button>
   <span className="result-count">Page {page} of {Math.max(1,Math.ceil((data?.total??0)/20))}</span>
   <button className="small-btn" disabled={loading||page*20>=(data?.total??0)} onClick={()=>setPage(p=>p+1)}>Next</button>
  </div>
 </section>;
}
