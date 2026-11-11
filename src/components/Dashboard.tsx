'use client';
import {useEffect,useMemo,useState} from 'react';
import { logout, type Identity } from '@/lib/auth/client';
import UserManagement from '@/components/UserManagement';
import MovementChart from '@/components/MovementChart';
import Phase6Reports from '@/components/Phase6Reports';
import ArchivedProducts from '@/components/ArchivedProducts';
import { useRouter } from 'next/navigation';
import { apiRequest, type ApiProduct, type ApiCategory, type ApiUnit, type ApiMovement, type ApiDashboard } from '@/lib/api/cloudstock';
type Role='admin'|'staff'|'viewer';
type Product={id:string;name:string;nameOriginal:string;nameEn:string;sku:string;category:string;categoryOriginal:string;categoryId:string;unit:string;unitId:string;price:number;stock:number;minimum:number};
type Tx={id:string;type:'IN'|'OUT';sku:string;quantity:number;actor:string;date:string;note:string};
type Page='dashboard'|'products'|'archived'|'categories'|'stock'|'transactions'|'reports'|'users';
const names:Record<Page,string>={dashboard:'Dashboard',products:'Products',archived:'Archived Products',categories:'Categories',stock:'Stock In / Out',transactions:'Transaction History',reports:'Reports',users:'Users'};
const permissions:Record<Role,Page[]>={admin:['dashboard','products','archived','categories','stock','transactions','reports','users'],staff:['dashboard','products','stock','transactions'],viewer:['dashboard','reports']};
const roles:Record<Role,string>={admin:'Administrator',staff:'Warehouse Staff',viewer:'Report Viewer'};
const icons:Record<Page,string>={dashboard:'◫',products:'◈',archived:'▤',categories:'▦',stock:'⇅',transactions:'☷',reports:'▥',users:'♙'};
const money=(v:number)=>new Intl.NumberFormat('en-US').format(v)+' ₫';
const date=(v:string)=>new Date(v).toLocaleString('en-US');
const stockLabel=(p:Product)=>p.stock===0?'Out of Stock':p.stock<p.minimum?'Low Stock':'In Stock';
const mapProduct=(p:ApiProduct):Product=>({id:p.id,name:p.name_en?.trim()||p.name,nameOriginal:p.name,nameEn:p.name_en||'',sku:p.sku,category:p.category_name_en?.trim()||p.category_name,categoryOriginal:p.category_name,categoryId:p.category_id,unit:p.unit_symbol_en?.trim()||p.unit_symbol,unitId:p.unit_id,price:Number(p.cost_price),stock:Number(p.stock_quantity),minimum:Number(p.minimum_stock)});
const mapMovement=(t:ApiMovement):Tx=>({id:t.id,type:t.type,sku:t.sku,quantity:t.quantity,actor:roles[t.actor_role as Role]||'Unknown',date:t.created_at,note:t.note||''});
export default function Dashboard({identity}:{identity:Identity}){
 const router=useRouter();
 const role:Role=identity.role;const [page,setPage]=useState<Page>('dashboard');
 const [products,setProducts]=useState<Product[]>([]);const [transactions,setTransactions]=useState<Tx[]>([]);
 const [loading,setLoading]=useState(true);const [dataError,setDataError]=useState('');const [categories,setCategories]=useState<ApiCategory[]>([]);const [units,setUnits]=useState<ApiUnit[]>([]);const [dashboardStats,setDashboardStats]=useState<ApiDashboard|null>(null);const [saving,setSaving]=useState(false);const [search,setSearch]=useState('');const [filter,setFilter]=useState('All');const [modal,setModal]=useState<'product'|'stock'|null>(null);
 const [nameAlreadyEnglish,setNameAlreadyEnglish]=useState(true);
 const [edit,setEdit]=useState<string|null>(null);const [form,setForm]=useState({name:'',nameEn:'',sku:'',category:'',unit:'',price:'0',stock:'0',minimum:'10'});
 const [stockForm,setStockForm]=useState({sku:'',type:'IN' as 'IN'|'OUT',quantity:'1',note:''});const [error,setError]=useState('');const [toast,setToast]=useState('');
 const editCategoryTranslation=async(c:ApiCategory)=>{
  const english=window.prompt(`English category name for ${c.name}:`,c.name_en||'');
  if(english===null)return;
  try{await apiRequest(`/categories/${c.id}/translation`,{method:'PATCH',body:JSON.stringify({nameEn:english})});await refresh();msg('Category translation updated.')}catch(e){setDataError(e instanceof Error?e.message:'Unable to update category translation')}
 };
 const editUnitTranslation=async(u:ApiUnit)=>{
  const nameEn=window.prompt(`English unit name for ${u.name}:`,u.name_en||'');if(nameEn===null)return;
  const symbolEn=window.prompt(`English unit symbol for ${u.symbol}:`,u.symbol_en||'');if(symbolEn===null)return;
  try{await apiRequest(`/units/${u.id}/translation`,{method:'PATCH',body:JSON.stringify({nameEn,symbolEn})});await refresh();msg('Unit translation updated.')}catch(e){setDataError(e instanceof Error?e.message:'Unable to update unit translation')}
 };
 const refresh = async()=>{
  setDataError('');
  try {
   const [list,cats,measure,stats,moves] = await Promise.all([
    apiRequest<{items:ApiProduct[];total:number}>('/products?limit=100'),
    apiRequest<ApiCategory[]>('/categories'),
    apiRequest<ApiUnit[]>('/units'),
    apiRequest<ApiDashboard>('/dashboard'),
    role==='viewer'?Promise.resolve([] as ApiMovement[]):apiRequest<ApiMovement[]>('/movements?limit=100'),
   ]);
   setProducts(list.items.map(mapProduct));setCategories(cats);setUnits(measure);
   setDashboardStats(stats);setTransactions(moves.map(mapMovement));
   if(list.total>list.items.length) setDataError(`Showing ${list.items.length}/${list.total} products. Pagination is needed to view all items.`);
  }catch(e){setDataError(e instanceof Error?e.message:'Unable to load data. Please try again.');}
  finally{setLoading(false)}
 };
 useEffect(()=>{void refresh();},[role]);
 const visible=useMemo(()=>products.filter(p=>(p.name+' '+p.nameOriginal+' '+p.sku+' '+p.category+' '+p.categoryOriginal).toLowerCase().includes(search.toLowerCase())&&(filter==='All'||stockLabel(p)===filter)),[products,search,filter]);
 const low=dashboardStats?.summary.low_stock??0, out=dashboardStats?.summary.out_of_stock??0;
 const productCount=dashboardStats?.summary.total_products??products.length;
 const total=Number(dashboardStats?.summary.total_units??0);
 const msg=(t:string)=>{setToast(t);window.setTimeout(()=>setToast(''),3200)};

 const startProduct=(p?:Product)=>{
  setError('');
  setEdit(p?.id||null);
  const originalName=p?.nameOriginal||'';
  const translatedName=p?.nameEn||'';
  // Preserve bilingual names when editing. Only auto-copy if both names are already equal.
  const isEnglish=!p || (translatedName.trim()!=='' && translatedName.trim()===originalName.trim());
  setNameAlreadyEnglish(isEnglish);
  setForm(p?{name:originalName,nameEn:translatedName,sku:p.sku,category:p.categoryId,unit:p.unitId,price:String(p.price),stock:String(p.stock),minimum:String(p.minimum)}:{name:'',nameEn:'',sku:'',category:categories[0]?.id||'',unit:units[0]?.id||'',price:'0',stock:'0',minimum:'10'});
  setModal('product');
 };
 const toggleNameAlreadyEnglish=(checked:boolean)=>{
  setNameAlreadyEnglish(checked);
  setError('');
  if(checked) setForm(prev=>({...prev,nameEn:prev.name}));
  else setForm(prev=>({...prev,nameEn:prev.nameEn===prev.name?'':prev.nameEn}));
 };
 const saveProduct=async()=>{
  if(role!=='admin'||saving)return;
  const category=categories.find(c=>c.id===form.category);const unit=units.find(u=>u.id===form.unit);
  const price=Number(form.price),minimum=Number(form.minimum),initial=Number(form.stock);
  if(!form.name.trim()||!form.sku.trim()||!category||!unit){setError('Enter SKU and name, then select an existing category and unit.');return}
  const englishName=nameAlreadyEnglish?form.name.trim():form.nameEn.trim();
  if(!englishName){setError('Enter the English Product Name before saving.');return}
  if(!Number.isFinite(price)||price<0||!Number.isInteger(minimum)||minimum<0||!Number.isInteger(initial)||initial<0){setError('Invalid price or quantity.');return}
  if(!edit&&initial>0){setError('New products must start at zero stock. Use Stock In to record initial inventory.');return}
  setSaving(true);setError('');
  try{
   await apiRequest(`/products${edit?`/${edit}`:''}`,{method:edit?'PATCH':'POST',body:JSON.stringify({name:form.name.trim(),nameEn:englishName,sku:form.sku.trim().toUpperCase(),categoryId:category.id,unitId:unit.id,costPrice:price,minimumStock:minimum})});
   setModal(null);await refresh();msg(edit?'Product updated successfully.':'Product created successfully.');
  }catch(e){setError(e instanceof Error?e.message:'Unable to save product')}
  finally{setSaving(false)}
 };
 const saveStock=async()=>{
  if(role==='viewer'||saving)return;
  const qty=Number(stockForm.quantity),product=products.find(p=>p.sku===stockForm.sku);
  if(!product){setError('Product not found');return}
  if(!Number.isSafeInteger(qty)||qty<=0){setError('Quantity must be a positive integer');return}
  if(stockForm.type==='OUT'&&qty>product.stock){setError('Insufficient stock');return}
  setSaving(true);setError('');
  try{
   await apiRequest('/movements',{method:'POST',body:JSON.stringify({productId:product.id,type:stockForm.type,quantity:qty,note:stockForm.note})});
   setModal(null);await refresh();msg('Stock movement saved successfully.');
  }catch(e){setError(e instanceof Error?e.message:'Transaction failed')}
  finally{setSaving(false)}
 };
 const del=async(p:Product)=>{
  if(role!=='admin'||!confirm(`Archive product ${p.name}? You can restore it later from Archived Products.`))return;
  try{await apiRequest(`/products/${p.id}`,{method:'DELETE'});await refresh();msg('Product archived. You can restore it from Archived Products.')}
  catch(e){setDataError(e instanceof Error?e.message:'Unable to delete product')}
 };
 const badge=(p:Product)=><span className={'tag '+(p.stock===0?'danger':p.stock<p.minimum?'warning':'success')}>{stockLabel(p)}</span>;
 const productTable=(small=false)=><div className="table-scroll"><table><thead><tr><th>Product Name</th><th>SKU</th><th>Category</th><th>Stock</th><th>Minimum</th><th>Status</th>{!small&&<th>Actions</th>}</tr></thead><tbody>{visible.slice(0,small?6:undefined).map(p=><tr key={p.id}><td><div className="item-name"><span className="item-avatar">{p.categoryOriginal==='Điện tử'?'⌁':p.categoryOriginal==='Gia dụng'?'▤':'▣'}</span><strong>{p.name}</strong></div></td><td className="mono">{p.sku}</td><td>{p.category}</td><td>{p.stock.toLocaleString('en-US')} {p.unit.toLowerCase()}</td><td>{p.minimum}</td><td>{badge(p)}</td>{!small&&<td className="actions">{role==='admin'&&<><button className="small-btn" onClick={()=>startProduct(p)}>Edit</button><button className="small-btn red" onClick={()=>del(p)}>Delete</button></>}{role==='staff'&&<button className="small-btn" onClick={()=>{setStockForm({...stockForm,sku:p.sku});setError('');setModal('stock')}}>Create Movement</button>}</td>}</tr>)}{visible.length===0&&<tr><td colSpan={7} className="empty">No matching products found.</td></tr>}</tbody></table></div>;
 return <div className="app"><aside className="sidebar"><div className="brand"><span className="brand-icon">▥</span><span>Cloud<span className="brand-accent">Stock</span></span></div><div className="sidebar-caption">INVENTORY MANAGEMENT</div><nav>{permissions[role].map(p=><button key={p} className={'nav-item '+(page===p?'active':'')} onClick={()=>{setPage(p);setSearch('');setFilter('All')}}><span className="nav-icon">{icons[p]}</span>{names[p]}{p==='products'&&low+out>0&&<span className="nav-count">{low+out}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="demo-flag">● SYSTEM ONLINE</div><div className="profile"><span className="avatar">{role==='admin'?'A':role==='staff'?'K':'B'}</span><div><b>{role==='admin'?'System Administrator':role==='staff'?'Warehouse Staff':'Reporting Team'}</b><small>{identity.email || roles[role]}</small></div></div></div></aside>
 <main className="main"><header className="topbar"><div><div className="eyebrow">INVENTORY MANAGEMENT SYSTEM / {names[page].toUpperCase()}</div><h1>{page==='dashboard'?'Welcome back!':names[page]}</h1><p>{role==='admin'?'Monitor and manage your warehouse operations.':role==='staff'?'Receive, verify, and record stock movements.':'Monitor inventory metrics and reports.'}</p></div><div className="top-actions"><div className="role-box"><span>Role</span><strong>{roles[role]}</strong></div><button className="logout-btn" onClick={async()=>{await logout().catch(()=>{});router.replace('/login')}}>Sign Out</button><div className="bell" title="Stock Alerts">♧{low+out>0&&<i>{low+out}</i>}</div></div></header>
 {loading&&<div className="panel" style={{padding:18}}>Loading data...</div>}{dataError&&<div className="form-error" role="alert">{dataError} <button className="small-btn" onClick={()=>void refresh()}>Retry</button></div>}{page==='dashboard'&&<><div className="metrics"><div className="metric"><span>Total Products</span><b>{productCount.toLocaleString('en-US')}</b><small className="change positive">Tracked product records</small><span className="metric-icon">◈</span></div><div className="metric"><span>Total Units in Stock</span><b>{total.toLocaleString('en-US')}</b><small className="change positive">Currently in warehouse</small><span className="metric-icon">▤</span></div><div className="metric"><span>Low Stock</span><b>{low}</b><small className="change negative">Replenishment required</small><span className="metric-icon">⚑</span></div><div className="metric"><span>Out of Stock</span><b>{out}</b><small className="change negative">Attention required</small><span className="metric-icon">⊘</span></div></div>
 <div className="analytics"><MovementChart/><section className="panel alerts-panel"><div className="panel-head"><div><h2>Stock Alerts</h2><p>Inventory status breakdown</p></div></div><div className="donut" style={{background:`conic-gradient(#65bf92 0 ${productCount?(productCount-low-out)/productCount*100:0}%,#ff9b93 ${productCount?(productCount-low-out)/productCount*100:0}% ${productCount?(productCount-out)/productCount*100:0}%,#a9a9bd ${productCount?(productCount-out)/productCount*100:0}% 100%)`}}><div><b>{productCount}</b><span>products</span></div></div><div className="donut-legend"><div><i className="dot green"/>In Stock <strong>{productCount-low-out}</strong></div><div><i className="dot coral"/>Low Stock <strong>{low}</strong></div><div><i className="dot gray"/>Out of Stock <strong>{out}</strong></div></div></section></div>
 <section className="panel"><div className="panel-head"><div><h2>Product List</h2><p>Latest inventory status</p></div><button className="btn secondary" onClick={()=>setPage(role==='viewer'?'reports':'products')}>{role==='viewer'?'View Reports':'View All'} ↗</button></div>{productTable(true)}</section></>}
 {page==='products'&&<section className="panel"><div className="panel-head"><div><h2>Product List</h2><p>Manage SKUs, categories, cost prices and stock thresholds</p></div>{role==='admin'&&<button className="btn primary" onClick={()=>startProduct()}>＋ Add Product</button>}</div><div className="filters"><input placeholder="⌕  Search product name, SKU, category..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','In Stock','Low Stock','Out of Stock'].map(x=><option key={x}>{x}</option>)}</select><span className="result-count">{visible.length} products</span></div>{productTable()}</section>}
 {page==='categories'&&<section className="panel"><div className="panel-head"><div><h2>Product Categories</h2><p>Organize product groups</p></div></div><div className="category-grid">{categories.map(c=><div className="category-card" key={c.id}><div className="category-symbol">▦</div><h3>{c.name_en||c.name}</h3><p>{products.filter(p=>p.categoryId===c.id).length} products</p>{role==='admin'&&<button className="small-btn" onClick={()=>void editCategoryTranslation(c)}>Edit English Name</button>}</div>)}</div><h3>Measurement Units</h3><div className="category-grid">{units.map(u=><div className="category-card" key={u.id}><h3>{u.name_en||u.name}</h3><p>{u.symbol_en||u.symbol}</p>{role==='admin'&&<button className="small-btn" onClick={()=>void editUnitTranslation(u)}>Edit English Name</button>}</div>)}</div><p className="hint">Categories are loaded from PostgreSQL. Use the admin API to create new categories.</p></section>}
 {page==='stock'&&<><div className="inline-heading"><p>Record stock in/out and update balances automatically.</p><button className="btn primary" onClick={()=>{setError('');setStockForm(f=>({...f,sku:f.sku||products[0]?.sku||''}));setModal('stock')}}>＋ Create Stock Movement</button></div><section className="panel"><div className="panel-head"><h2>Current Inventory</h2></div>{productTable(true)}</section></>}
 {page==='transactions'&&<section className="panel"><div className="panel-head"><div><h2>Stock Movement History</h2><p>Auditable stock movements with timestamps and actors</p></div></div><div className="table-scroll"><table><thead><tr><th>Time</th><th>Transaction ID</th><th>Type</th><th>Products</th><th>Quantity</th><th>Performed By</th><th>Note</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>{date(t.date)}</td><td className="mono">{t.id.slice(0,8)}</td><td><span className={'tag '+(t.type==='IN'?'success':'warning')}>{t.type==='IN'?'Stock In':'Stock Out'}</span></td><td>{t.sku}</td><td>{t.quantity}</td><td>{t.actor}</td><td>{t.note||'—'}</td></tr>)}{!transactions.length&&<tr><td colSpan={7} className="empty">No transactions yet. Try recording a stock movement.</td></tr>}</tbody></table></div></section>}
 {page==='reports'&&<Phase6Reports/>}
 {page==='archived'&&role==='admin'&&<ArchivedProducts onRestored={refresh}/>}
 {page==='users'&&<UserManagement ownId={identity.id}/>}
 <footer>© CloudStock · Inventory Management</footer></main>
 {toast&&<div className="toast">✓ {toast}</div>}
 {modal&&<div className="overlay" onClick={()=>setModal(null)}><div className="dialog" onClick={e=>e.stopPropagation()}><div className="dialog-head"><div><h2>{modal==='product'?(edit?'Edit Product':'Add New Product'):'Create Stock Movement'}</h2><p>{modal==='product'?'Choose an existing category and unit.':'Stock quantities will update once the movement is confirmed.'}</p></div><button className="close" onClick={()=>setModal(null)}>✕</button></div>{modal==='product'?<div className="form-grid"><label className="wide">Product Name<input value={form.name} maxLength={160} placeholder="Enter product name" onChange={e=>setForm(prev=>({...prev,name:e.target.value,nameEn:nameAlreadyEnglish?e.target.value:prev.nameEn}))}/></label><div className="wide" style={{padding:'2px 0 4px'}}><label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',fontWeight:500}}><input type="checkbox" checked={nameAlreadyEnglish} onChange={e=>toggleNameAlreadyEnglish(e.target.checked)} style={{width:17,height:17,flex:'none',accentColor:'#7569eb'}}/><span>Product name is already in English</span></label><p className="hint" style={{margin:'5px 0 0 27px'}}>{nameAlreadyEnglish?'The English name will be saved automatically using the product name above.':'Enter the original Vietnamese name above, then provide its English translation below.'}</p></div>{!nameAlreadyEnglish&&<label className="wide">English Product Name<input value={form.nameEn} maxLength={160} placeholder="Enter English product name" onChange={e=>setForm(prev=>({...prev,nameEn:e.target.value}))}/></label>}<label>SKU<input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})}/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name_en||c.name}</option>)}</select></label><label>Unit<select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{units.map(u=><option key={u.id} value={u.id}>{u.name_en||u.name} ({u.symbol_en||u.symbol})</option>)}</select></label><label>Cost Price (VND)<input type="number" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Initial Stock (0; use Stock In)<input type="number" min="0" disabled={!!edit} value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label><label>Low Stock Threshold<input type="number" min="0" value={form.minimum} onChange={e=>setForm({...form,minimum:e.target.value})}/></label></div>:<div className="form-grid"><label className="wide">Product<select value={stockForm.sku} onChange={e=>setStockForm({...stockForm,sku:e.target.value})}>{products.map(p=><option key={p.id} value={p.sku}>{p.name} ({p.sku}) — stock {p.stock}</option>)}</select></label><label>Movement Type<select value={stockForm.type} onChange={e=>setStockForm({...stockForm,type:e.target.value as 'IN'|'OUT'})}><option value="IN">Stock In</option><option value="OUT">Stock Out</option></select></label><label>Quantity<input type="number" min="1" value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})}/></label><label className="wide">Note<input value={stockForm.note} onChange={e=>setStockForm({...stockForm,note:e.target.value})} placeholder="Reason for movement"/></label></div>}{error&&<div className="form-error">{error}</div>}<div className="dialog-actions"><button className="btn secondary" onClick={()=>setModal(null)}>Cancel</button><button className="btn primary" disabled={saving} onClick={modal==='product'?saveProduct:saveStock}>{saving?'Saving...':'Confirm'}</button></div></div></div>}
 </div>
}
