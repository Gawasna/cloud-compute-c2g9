'use client';
import {useEffect,useMemo,useState} from 'react';
import { logout, type Identity } from '@/lib/auth/client';
import UserManagement from '@/components/UserManagement';
import MovementChart from '@/components/MovementChart';
import Phase6Reports from '@/components/Phase6Reports';
import { useRouter } from 'next/navigation';
import { apiRequest, type ApiProduct, type ApiCategory, type ApiUnit, type ApiMovement, type ApiDashboard } from '@/lib/api/cloudstock';
type Role='admin'|'staff'|'viewer';
type Product={id:string;name:string;sku:string;category:string;unit:string;price:number;stock:number;minimum:number};
type Tx={id:string;type:'IN'|'OUT';sku:string;quantity:number;actor:string;date:string;note:string};
type Page='dashboard'|'products'|'categories'|'stock'|'transactions'|'reports'|'users';
const names:Record<Page,string>={dashboard:'Tổng quan',products:'Sản phẩm',categories:'Danh mục',stock:'Nhập / xuất kho',transactions:'Lịch sử giao dịch',reports:'Báo cáo',users:'Người dùng'};
const permissions:Record<Role,Page[]>={admin:['dashboard','products','categories','stock','transactions','reports','users'],staff:['dashboard','products','stock','transactions'],viewer:['dashboard','reports']};
const roles:Record<Role,string>={admin:'Quản trị viên',staff:'Nhân viên kho',viewer:'Người xem báo cáo'};
const icons:Record<Page,string>={dashboard:'◫',products:'◈',categories:'▦',stock:'⇅',transactions:'☷',reports:'▥',users:'♙'};
const money=(v:number)=>new Intl.NumberFormat('vi-VN').format(v)+' ₫';
const date=(v:string)=>new Date(v).toLocaleString('vi-VN');
const stockLabel=(p:Product)=>p.stock===0?'Hết hàng':p.stock<p.minimum?'Sắp hết':'Còn hàng';
const mapProduct=(p:ApiProduct):Product=>({id:p.id,name:p.name,sku:p.sku,category:p.category_name,unit:p.unit_symbol,price:Number(p.cost_price),stock:Number(p.stock_quantity),minimum:Number(p.minimum_stock)});
const mapMovement=(t:ApiMovement):Tx=>({id:t.id,type:t.type,sku:t.sku,quantity:t.quantity,actor:roles[t.actor_role as Role]||'Chưa xác định',date:t.created_at,note:t.note||''});
export default function Dashboard({identity}:{identity:Identity}){
 const router=useRouter();
 const role:Role=identity.role;const [page,setPage]=useState<Page>('dashboard');
 const [products,setProducts]=useState<Product[]>([]);const [transactions,setTransactions]=useState<Tx[]>([]);
 const [loading,setLoading]=useState(true);const [dataError,setDataError]=useState('');const [categories,setCategories]=useState<ApiCategory[]>([]);const [units,setUnits]=useState<ApiUnit[]>([]);const [dashboardStats,setDashboardStats]=useState<ApiDashboard|null>(null);const [saving,setSaving]=useState(false);const [search,setSearch]=useState('');const [filter,setFilter]=useState('Tất cả');const [modal,setModal]=useState<'product'|'stock'|null>(null);
 const [edit,setEdit]=useState<string|null>(null);const [form,setForm]=useState({name:'',sku:'',category:'Điện tử',unit:'Cái',price:'0',stock:'0',minimum:'10'});
 const [stockForm,setStockForm]=useState({sku:'',type:'IN' as 'IN'|'OUT',quantity:'1',note:''});const [error,setError]=useState('');const [toast,setToast]=useState('');
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
   if(list.total>list.items.length) setDataError(`Đang hiển thị ${list.items.length}/${list.total} sản phẩm. Cần bổ sung phân trang để xem hết.`);
  }catch(e){setDataError(e instanceof Error?e.message:'Không tải được dữ liệu. Vui lòng thử lại.');}
  finally{setLoading(false)}
 };
 useEffect(()=>{void refresh();},[role]);
 const visible=useMemo(()=>products.filter(p=>(p.name+' '+p.sku+' '+p.category).toLowerCase().includes(search.toLowerCase())&&(filter==='Tất cả'||stockLabel(p)===filter)),[products,search,filter]);
 const low=dashboardStats?.summary.low_stock??0, out=dashboardStats?.summary.out_of_stock??0;
 const productCount=dashboardStats?.summary.total_products??products.length;
 const total=Number(dashboardStats?.summary.total_units??0);
 const msg=(t:string)=>{setToast(t);window.setTimeout(()=>setToast(''),3200)};

 const startProduct=(p?:Product)=>{setError('');setEdit(p?.id||null);setForm(p?{name:p.name,sku:p.sku,category:p.category,unit:p.unit,price:String(p.price),stock:String(p.stock),minimum:String(p.minimum)}:{name:'',sku:'',category:categories[0]?.name||'',unit:units[0]?.symbol||'',price:'0',stock:'0',minimum:'10'});setModal('product')};
 const saveProduct=async()=>{
  if(role!=='admin'||saving)return;
  const category=categories.find(c=>c.name===form.category);const unit=units.find(u=>u.symbol===form.unit);
  const price=Number(form.price),minimum=Number(form.minimum),initial=Number(form.stock);
  if(!form.name.trim()||!form.sku.trim()||!category||!unit){setError('Vui lòng nhập SKU, tên và chọn danh mục, đơn vị đã tồn tại.');return}
  if(!Number.isFinite(price)||price<0||!Number.isInteger(minimum)||minimum<0||!Number.isInteger(initial)||initial<0){setError('Giá và số lượng không hợp lệ.');return}
  if(!edit&&initial>0){setError('Sản phẩm mới phải có tồn ban đầu bằng 0. Sau khi tạo, sử dụng phiếu nhập kho để ghi nhận tồn và lịch sử giao dịch.');return}
  setSaving(true);setError('');
  try{
   await apiRequest(`/products${edit?`/${edit}`:''}`,{method:edit?'PATCH':'POST',body:JSON.stringify({name:form.name.trim(),sku:form.sku.trim().toUpperCase(),categoryId:category.id,unitId:unit.id,costPrice:price,minimumStock:minimum})});
   setModal(null);await refresh();msg(edit?'Đã cập nhật sản phẩm thành công.':'Đã thêm sản phẩm thành công.');
  }catch(e){setError(e instanceof Error?e.message:'Lưu sản phẩm thất bại')}
  finally{setSaving(false)}
 };
 const saveStock=async()=>{
  if(role==='viewer'||saving)return;
  const qty=Number(stockForm.quantity),product=products.find(p=>p.sku===stockForm.sku);
  if(!product){setError('Sản phẩm không tồn tại');return}
  if(!Number.isSafeInteger(qty)||qty<=0){setError('Số lượng phải là số nguyên dương');return}
  if(stockForm.type==='OUT'&&qty>product.stock){setError('Không thể xuất quá tồn kho');return}
  setSaving(true);setError('');
  try{
   await apiRequest('/movements',{method:'POST',body:JSON.stringify({productId:product.id,type:stockForm.type,quantity:qty,note:stockForm.note})});
   setModal(null);await refresh();msg('Đã lưu phiếu nhập / xuất kho thành công.');
  }catch(e){setError(e instanceof Error?e.message:'Giao dịch thất bại')}
  finally{setSaving(false)}
 };
 const del=async(p:Product)=>{
  if(role!=='admin'||!confirm(`Xóa sản phẩm ${p.name}?`))return;
  try{await apiRequest(`/products/${p.id}`,{method:'DELETE'});await refresh();msg('Đã xóa sản phẩm thành công.')}
  catch(e){setDataError(e instanceof Error?e.message:'Không thể xóa sản phẩm')}
 };
 const badge=(p:Product)=><span className={'tag '+(p.stock===0?'danger':p.stock<p.minimum?'warning':'success')}>{stockLabel(p)}</span>;
 const productTable=(small=false)=><div className="table-scroll"><table><thead><tr><th>Tên sản phẩm</th><th>Mã SKU</th><th>Danh mục</th><th>Tồn kho</th><th>Ngưỡng</th><th>Trạng thái</th>{!small&&<th>Thao tác</th>}</tr></thead><tbody>{visible.slice(0,small?6:undefined).map(p=><tr key={p.id}><td><div className="item-name"><span className="item-avatar">{p.category==='Điện tử'?'⌁':p.category==='Gia dụng'?'▤':'▣'}</span><strong>{p.name}</strong></div></td><td className="mono">{p.sku}</td><td>{p.category}</td><td>{p.stock.toLocaleString('vi-VN')} {p.unit.toLowerCase()}</td><td>{p.minimum}</td><td>{badge(p)}</td>{!small&&<td className="actions">{role==='admin'&&<><button className="small-btn" onClick={()=>startProduct(p)}>Sửa</button><button className="small-btn red" onClick={()=>del(p)}>Xóa</button></>}{role==='staff'&&<button className="small-btn" onClick={()=>{setStockForm({...stockForm,sku:p.sku});setError('');setModal('stock')}}>Tạo phiếu</button>}</td>}</tr>)}{visible.length===0&&<tr><td colSpan={7} className="empty">Không tìm thấy sản phẩm phù hợp.</td></tr>}</tbody></table></div>;
 return <div className="app"><aside className="sidebar"><div className="brand"><span className="brand-icon">▥</span><span>Cloud<span className="brand-accent">Stock</span></span></div><div className="sidebar-caption">QUẢN LÝ KHO</div><nav>{permissions[role].map(p=><button key={p} className={'nav-item '+(page===p?'active':'')} onClick={()=>{setPage(p);setSearch('');setFilter('Tất cả')}}><span className="nav-icon">{icons[p]}</span>{names[p]}{p==='products'&&low+out>0&&<span className="nav-count">{low+out}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="demo-flag">● HỆ THỐNG ĐANG HOẠT ĐỘNG</div><div className="profile"><span className="avatar">{role==='admin'?'A':role==='staff'?'K':'B'}</span><div><b>{role==='admin'?'Quản trị hệ thống':role==='staff'?'Nhân viên kho':'Bộ phận báo cáo'}</b><small>{identity.email || roles[role]}</small></div></div></div></aside>
 <main className="main"><header className="topbar"><div><div className="eyebrow">HỆ THỐNG QUẢN LÝ TỒN KHO / {names[page].toUpperCase()}</div><h1>{page==='dashboard'?'Xin chào, chào mừng trở lại!':names[page]}</h1><p>{role==='admin'?'Theo dõi và quản lý hoạt động kho của bạn.':role==='staff'?'Tiếp nhận, kiểm tra và ghi nhận hàng hóa.':'Theo dõi các chỉ số và báo cáo hàng tồn kho.'}</p></div><div className="top-actions"><div className="role-box"><span>Vai trò</span><strong>{roles[role]}</strong></div><button className="logout-btn" onClick={async()=>{await logout().catch(()=>{});router.replace('/login')}}>Đăng xuất</button><div className="bell" title="Cảnh báo tồn kho">♧{low+out>0&&<i>{low+out}</i>}</div></div></header>
 {loading&&<div className="panel" style={{padding:18}}>Đang tải dữ liệu...</div>}{dataError&&<div className="form-error" role="alert">{dataError} <button className="small-btn" onClick={()=>void refresh()}>Tải lại</button></div>}{page==='dashboard'&&<><div className="metrics"><div className="metric"><span>Tổng sản phẩm</span><b>{productCount.toLocaleString('vi-VN')}</b><small className="change positive">Danh mục đang quản lý</small><span className="metric-icon">◈</span></div><div className="metric"><span>Tổng đơn vị tồn</span><b>{total.toLocaleString('vi-VN')}</b><small className="change positive">Đang có trong kho</small><span className="metric-icon">▤</span></div><div className="metric"><span>Sắp hết hàng</span><b>{low}</b><small className="change negative">Cần nhập thêm</small><span className="metric-icon">⚑</span></div><div className="metric"><span>Đã hết hàng</span><b>{out}</b><small className="change negative">Cần xử lý</small><span className="metric-icon">⊘</span></div></div>
 <div className="analytics"><MovementChart/><section className="panel alerts-panel"><div className="panel-head"><div><h2>Cảnh báo tồn kho</h2><p>Phân loại tình trạng sản phẩm</p></div></div><div className="donut" style={{background:`conic-gradient(#65bf92 0 ${productCount?(productCount-low-out)/productCount*100:0}%,#ff9b93 ${productCount?(productCount-low-out)/productCount*100:0}% ${productCount?(productCount-out)/productCount*100:0}%,#a9a9bd ${productCount?(productCount-out)/productCount*100:0}% 100%)`}}><div><b>{productCount}</b><span>sản phẩm</span></div></div><div className="donut-legend"><div><i className="dot green"/>Còn hàng <strong>{productCount-low-out}</strong></div><div><i className="dot coral"/>Sắp hết <strong>{low}</strong></div><div><i className="dot gray"/>Hết hàng <strong>{out}</strong></div></div></section></div>
 <section className="panel"><div className="panel-head"><div><h2>Danh sách sản phẩm</h2><p>Tình trạng hàng hóa mới nhất trong kho</p></div><button className="btn secondary" onClick={()=>setPage(role==='viewer'?'reports':'products')}>{role==='viewer'?'Xem báo cáo':'Xem tất cả'} ↗</button></div>{productTable(true)}</section></>}
 {page==='products'&&<section className="panel"><div className="panel-head"><div><h2>Danh sách sản phẩm</h2><p>Quản lý SKU, danh mục, giá vốn và định mức tồn kho</p></div>{role==='admin'&&<button className="btn primary" onClick={()=>startProduct()}>＋ Thêm sản phẩm</button>}</div><div className="filters"><input placeholder="⌕  Tìm tên, mã SKU, danh mục..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={filter} onChange={e=>setFilter(e.target.value)}>{['Tất cả','Còn hàng','Sắp hết','Hết hàng'].map(x=><option key={x}>{x}</option>)}</select><span className="result-count">{visible.length} sản phẩm</span></div>{productTable()}</section>}
 {page==='categories'&&<section className="panel"><div className="panel-head"><div><h2>Danh mục hàng hóa</h2><p>Phân nhóm các mặt hàng hiện có</p></div></div><div className="category-grid">{categories.map(item=>item.name).map(c=><div className="category-card" key={c}><div className="category-symbol">▦</div><h3>{c}</h3><p>{products.filter(p=>p.category===c).length} sản phẩm</p></div>)}</div><p className="hint">Danh mục được đọc từ PostgreSQL. Để tạo danh mục mới hãy sử dụng API quản trị danh mục.</p></section>}
 {page==='stock'&&<><div className="inline-heading"><p>Ghi nhận phiếu nhập và xuất, tự động tính số lượng còn lại.</p><button className="btn primary" onClick={()=>{setError('');setStockForm(f=>({...f,sku:f.sku||products[0]?.sku||''}));setModal('stock')}}>＋ Tạo phiếu nhập / xuất</button></div><section className="panel"><div className="panel-head"><h2>Tồn kho hiện tại</h2></div>{productTable(true)}</section></>}
 {page==='transactions'&&<section className="panel"><div className="panel-head"><div><h2>Lịch sử nhập xuất</h2><p>Nhật ký giao dịch có thời gian và người thực hiện</p></div></div><div className="table-scroll"><table><thead><tr><th>Thời gian</th><th>Mã phiếu</th><th>Loại</th><th>Sản phẩm</th><th>Số lượng</th><th>Người thực hiện</th><th>Ghi chú</th></tr></thead><tbody>{transactions.map(t=><tr key={t.id}><td>{date(t.date)}</td><td className="mono">{t.id.slice(0,8)}</td><td><span className={'tag '+(t.type==='IN'?'success':'warning')}>{t.type==='IN'?'Nhập':'Xuất'}</span></td><td>{t.sku}</td><td>{t.quantity}</td><td>{t.actor}</td><td>{t.note||'—'}</td></tr>)}{!transactions.length&&<tr><td colSpan={7} className="empty">Chưa có giao dịch. Hãy thử tạo phiếu nhập hoặc xuất.</td></tr>}</tbody></table></div></section>}
 {page==='reports'&&<Phase6Reports/>}
 {page==='users'&&<UserManagement ownId={identity.id}/>}
 <footer>© CloudStock · Hệ thống quản lý kho</footer></main>
 {toast&&<div className="toast">✓ {toast}</div>}
 {modal&&<div className="overlay" onClick={()=>setModal(null)}><div className="dialog" onClick={e=>e.stopPropagation()}><div className="dialog-head"><div><h2>{modal==='product'?(edit?'Chỉnh sửa sản phẩm':'Thêm sản phẩm mới'):'Tạo phiếu nhập / xuất kho'}</h2><p>{modal==='product'?'Vui lòng chọn danh mục và đơn vị tính đã được thiết lập.':'Số lượng tồn kho sẽ được cập nhật sau khi xác nhận phiếu.'}</p></div><button className="close" onClick={()=>setModal(null)}>✕</button></div>{modal==='product'?<div className="form-grid"><label className="wide">Tên sản phẩm<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Mã SKU<input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})}/></label><label>Danh mục<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label><label>Đơn vị tính<select value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}>{units.map(u=><option key={u.id} value={u.symbol}>{u.name} ({u.symbol})</option>)}</select></label><label>Giá vốn (VNĐ)<input type="number" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Tồn ban đầu (0; nhập kho bằng phiếu)<input type="number" min="0" disabled={!!edit} value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})}/></label><label>Ngưỡng cảnh báo<input type="number" min="0" value={form.minimum} onChange={e=>setForm({...form,minimum:e.target.value})}/></label></div>:<div className="form-grid"><label className="wide">Sản phẩm<select value={stockForm.sku} onChange={e=>setStockForm({...stockForm,sku:e.target.value})}>{products.map(p=><option key={p.id} value={p.sku}>{p.name} ({p.sku}) — tồn {p.stock}</option>)}</select></label><label>Loại giao dịch<select value={stockForm.type} onChange={e=>setStockForm({...stockForm,type:e.target.value as 'IN'|'OUT'})}><option value="IN">Nhập kho</option><option value="OUT">Xuất kho</option></select></label><label>Số lượng<input type="number" min="1" value={stockForm.quantity} onChange={e=>setStockForm({...stockForm,quantity:e.target.value})}/></label><label className="wide">Ghi chú<input value={stockForm.note} onChange={e=>setStockForm({...stockForm,note:e.target.value})} placeholder="Lý do nhập / xuất"/></label></div>}{error&&<div className="form-error">{error}</div>}<div className="dialog-actions"><button className="btn secondary" onClick={()=>setModal(null)}>Hủy</button><button className="btn primary" disabled={saving} onClick={modal==='product'?saveProduct:saveStock}>{saving?'Đang lưu...':'Xác nhận'}</button></div></div></div>}
 </div>
}
