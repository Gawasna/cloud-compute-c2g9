'use client';
import {useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api/cloudstock';

type Role='admin'|'staff'|'viewer';
type UserRow={id:string;email:string;display_name:string;role:Role;is_active:boolean;created_at:string};
const labels:Record<Role,string>={admin:'Quản trị viên',staff:'Nhân viên kho',viewer:'Người xem báo cáo'};
export default function UserManagement({ownId}:{ownId:string}){
 const [rows,setRows]=useState<UserRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showCreate,setShowCreate]=useState(false);
 const [form,setForm]=useState({displayName:'',email:'',password:'',role:'staff' as Role});
 const load=async()=>{setLoading(true);setError('');try{setRows(await apiRequest<UserRow[]>('/users'))}catch(e){setError(e instanceof Error?e.message:'Không tải được danh sách tài khoản')}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const action=async (fn:()=>Promise<unknown>,success:string)=>{
  setSaving(true);setError('');setMessage('');
  try{await fn();await load();setMessage(success)}catch(e){setError(e instanceof Error?e.message:'Thao tác không thành công')}finally{setSaving(false)}
 };
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();
  await action(async()=>{await apiRequest('/users',{method:'POST',body:JSON.stringify(form)});setShowCreate(false);setForm({displayName:'',email:'',password:'',role:'staff'})},'Đã tạo tài khoản thành công.');
 };
 return <section className="panel user-management">
  <div className="panel-head"><div><h2>Quản lý tài khoản</h2><p>Quản lý nhân viên, vai trò và quyền sử dụng hệ thống.</p></div><button className="btn primary" onClick={()=>{setShowCreate(!showCreate);setError('');setMessage('')}}>＋ {showCreate?'Đóng':'Thêm tài khoản'}</button></div>
  {error&&<p className="user-error" role="alert">{error}</p>}{message&&<p className="user-success" role="status">{message}</p>}
  {showCreate&&<form className="user-create" onSubmit={create}>
   <label>Họ và tên<input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} required maxLength={120} placeholder="Tên nhân viên"/></label>
   <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="email@company.com"/></label>
   <label>Mật khẩu ban đầu<input type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required placeholder="Ít nhất 10 ký tự"/></label>
   <label>Vai trò<select value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}><option value="staff">Nhân viên kho</option><option value="viewer">Người xem báo cáo</option><option value="admin">Quản trị viên</option></select></label>
   <button type="submit" className="btn primary" disabled={saving}>{saving?'Đang lưu...':'Tạo tài khoản'}</button>
  </form>}
  {loading?<p className="user-status">Đang tải danh sách tài khoản...</p>:<div className="table-scroll"><table><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th><th>Thao tác</th></tr></thead><tbody>
   {rows.map(u=><tr key={u.id}><td><strong>{u.display_name||'Chưa cập nhật'}</strong><div className="user-secondary">{u.email||'Chưa có email'}</div></td><td><select aria-label={`Vai trò ${u.display_name}`} disabled={saving||u.id===ownId} value={u.role} onChange={e=>{const role=e.target.value as Role;if(!window.confirm(`Đổi vai trò của ${u.display_name} thành ${labels[role]}?`))return;void action(()=>apiRequest(`/users/${u.id}/role`,{method:'PATCH',body:JSON.stringify({role})}),'Đã cập nhật vai trò thành công.')}}><option value="admin">Quản trị viên</option><option value="staff">Nhân viên kho</option><option value="viewer">Người xem báo cáo</option></select></td><td><span className={'tag '+(u.is_active?'success':'danger')}>{u.is_active?'Đang hoạt động':'Đã khóa'}</span></td><td>{new Date(u.created_at).toLocaleDateString('vi-VN')}</td><td><button className={'small-btn '+(u.is_active?'red':'')} disabled={saving||u.id===ownId} title={u.id===ownId?'Không thể thay đổi trạng thái tài khoản của chính mình':''} onClick={()=>{const isActive=!u.is_active;if(!window.confirm(`${isActive?'Mở khóa':'Khóa'} tài khoản ${u.display_name}?`))return;void action(()=>apiRequest(`/users/${u.id}/status`,{method:'PATCH',body:JSON.stringify({isActive})}),isActive?'Đã mở khóa tài khoản.':'Đã khóa tài khoản.')}}>{u.id===ownId?'Tài khoản của bạn':u.is_active?'Khóa':'Mở khóa'}</button></td></tr>)}
   {!rows.length&&<tr><td colSpan={5}>Chưa có tài khoản nào.</td></tr>}
  </tbody></table></div>}
  <p className="user-status">Tài khoản bị khóa không thể đăng nhập hoặc tiếp tục sử dụng API. Không thể tự đổi quyền hoặc khóa tài khoản của chính mình.</p>
 </section>;
}
