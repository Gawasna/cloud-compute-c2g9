'use client';
import {useEffect,useState} from 'react';
import {apiRequest} from '@/lib/api/cloudstock';

type Role='admin'|'staff'|'viewer';
type UserRow={id:string;email:string;display_name:string;role:Role;is_active:boolean;created_at:string};
const labels:Record<Role,string>={admin:'Administrator',staff:'Warehouse Staff',viewer:'Report Viewer'};
export default function UserManagement({ownId}:{ownId:string}){
 const [rows,setRows]=useState<UserRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [showCreate,setShowCreate]=useState(false);
 const [form,setForm]=useState({displayName:'',email:'',password:'',role:'staff' as Role});
 const load=async()=>{setLoading(true);setError('');try{setRows(await apiRequest<UserRow[]>('/users'))}catch(e){setError(e instanceof Error?e.message:'Unable to load users')}finally{setLoading(false)}};
 useEffect(()=>{void load()},[]);
 const action=async (fn:()=>Promise<unknown>,success:string)=>{
  setSaving(true);setError('');setMessage('');
  try{await fn();await load();setMessage(success)}catch(e){setError(e instanceof Error?e.message:'Action failed')}finally{setSaving(false)}
 };
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();
  await action(async()=>{await apiRequest('/users',{method:'POST',body:JSON.stringify(form)});setShowCreate(false);setForm({displayName:'',email:'',password:'',role:'staff'})},'User created successfully.');
 };
 return <section className="panel user-management">
  <div className="panel-head"><div><h2>User Management</h2><p>Manage users, roles and access.</p></div><button className="btn primary" onClick={()=>{setShowCreate(!showCreate);setError('');setMessage('')}}>＋ {showCreate?'Close':'Add User'}</button></div>
  {error&&<p className="user-error" role="alert">{error}</p>}{message&&<p className="user-success" role="status">{message}</p>}
  {showCreate&&<form className="user-create" onSubmit={create}>
   <label>Full Name<input value={form.displayName} onChange={e=>setForm({...form,displayName:e.target.value})} required maxLength={120} placeholder="Employee name"/></label>
   <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="email@company.com"/></label>
   <label>Initial Password<input type="password" autoComplete="new-password" minLength={10} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required placeholder="At least 10 characters"/></label>
   <label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}><option value="staff">Warehouse Staff</option><option value="viewer">Report Viewer</option><option value="admin">Administrator</option></select></label>
   <button type="submit" className="btn primary" disabled={saving}>{saving?'Saving...':'Create User'}</button>
  </form>}
  {loading?<p className="user-status">Loading users...</p>:<div className="table-scroll"><table><thead><tr><th>Employee</th><th>Role</th><th>Status</th><th>Created At</th><th>Actions</th></tr></thead><tbody>
   {rows.map(u=><tr key={u.id}><td><strong>{u.display_name||'Not provided'}</strong><div className="user-secondary">{u.email||'No email'}</div></td><td><select aria-label={`Role ${u.display_name}`} disabled={saving||u.id===ownId} value={u.role} onChange={e=>{const role=e.target.value as Role;if(!window.confirm(`Change role for ${u.display_name} to ${labels[role]}?`))return;void action(()=>apiRequest(`/users/${u.id}/role`,{method:'PATCH',body:JSON.stringify({role})}),'Role updated successfully.')}}><option value="admin">Administrator</option><option value="staff">Warehouse Staff</option><option value="viewer">Report Viewer</option></select></td><td><span className={'tag '+(u.is_active?'success':'danger')}>{u.is_active?'Active':'Locked'}</span></td><td>{new Date(u.created_at).toLocaleDateString('en-US')}</td><td><button className={'small-btn '+(u.is_active?'red':'')} disabled={saving||u.id===ownId} title={u.id===ownId?'You cannot change your own account status':''} onClick={()=>{const isActive=!u.is_active;if(!window.confirm(`${isActive?'Unlock':'Lock'} account ${u.display_name}?`))return;void action(()=>apiRequest(`/users/${u.id}/status`,{method:'PATCH',body:JSON.stringify({isActive})}),isActive?'User unlocked.':'User locked.')}}>{u.id===ownId?'Your Account':u.is_active?'Lock':'Unlock'}</button></td></tr>)}
   {!rows.length&&<tr><td colSpan={5}>No users found.</td></tr>}
  </tbody></table></div>}
  <p className="user-status">Locked users cannot sign in or access the API. You cannot change your own role or lock yourself.</p>
 </section>;
}
