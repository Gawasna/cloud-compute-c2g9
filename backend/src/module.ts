import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {Module,Controller,Get,Post,Patch,Delete,Body,Param,Query,Req,UseGuards,Injectable,CanActivate,ExecutionContext,ForbiddenException,UnauthorizedException,BadRequestException,NotFoundException,ConflictException,OnModuleDestroy,Res} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {createClient} from '@supabase/supabase-js';
import {Pool} from 'pg';
import {IsString,IsOptional,IsInt,IsNumber,Min,MaxLength,IsIn,IsUUID} from 'class-validator';
import type {Request,Response} from 'express';
type Role='admin'|'staff'|'viewer';type AuthUser={id:string;role:Role};type AuthedRequest=Request&{user:AuthUser};
@Injectable() class Database implements OnModuleDestroy{
 // Cung cấp CA của PostgreSQL/Supabase bằng DATABASE_SSL_CA_PATH.
 // Giữ xác thực máy chủ; không dùng rejectUnauthorized: false.
 private readonly certificatePath = process.env.DATABASE_SSL_CA_PATH || 'certs/prod-ca-2021.crt';
 private readonly certificate = readFileSync(
  isAbsolute(this.certificatePath) ? this.certificatePath : resolve(process.cwd(), this.certificatePath),
  'utf8',
 );
 pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:{ca:this.certificate,rejectUnauthorized:true},
  max:5,
 });
 query(text:string,params:unknown[]=[]){return this.pool.query(text,params)}
 async onModuleDestroy(){await this.pool.end()}
}
@Injectable() class AuthGuard implements CanActivate{
 constructor(private db:Database){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest<AuthedRequest>();const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.substring(7):'';if(!token)throw new UnauthorizedException('Sign in required');
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;if(!url||!key)throw new UnauthorizedException('Supabase Auth is not configured');const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new UnauthorizedException('Invalid token');
 const r=await this.db.query('select role,is_active from public.profiles where id=$1',[data.user.id]);if(!r.rows[0])throw new ForbiddenException('Account role has not been assigned');if(!r.rows[0].is_active)throw new ForbiddenException('Account has been disabled');req.user={id:data.user.id,role:r.rows[0].role};return true}
}
@Controller('auth')@UseGuards(AuthGuard)class AuthController{
 @Get('me') me(@Req()req:AuthedRequest){return {id:req.user.id,role:req.user.role}}
}
const roles=(req:AuthedRequest,allowed:Role[])=>{if(!allowed.includes(req.user.role))throw new ForbiddenException('Insufficient permissions')};
// Admin-only translation suggestions. The external service is configured on the backend,
// so credentials never enter the browser or the Supabase database.
class TranslationSuggestionDto{
 @IsString() @MaxLength(160) text!:string;
}
@Injectable() class TranslationService{
 async suggest(source:string):Promise<{suggestion:string;source:'existing'|'provider'}>{
  const text=source.trim();
  if(!text || text.length>160)throw new BadRequestException('Product name must contain 1–160 characters');
  const endpoint=process.env.TRANSLATION_API_URL;
  if(!endpoint)throw new BadRequestException('Automatic translation is not configured. Enter the English name manually or configure TRANSLATION_API_URL.');
  let url:URL;
  try{url=new URL(endpoint)}catch{throw new BadRequestException('Invalid translation provider URL')}
  // Never let client supply a URL: only the server administrator configures the endpoint.
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))
   throw new BadRequestException('Translation provider requires HTTPS (except localhost)');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch(url.toString(),{
    method:'POST',signal:controller.signal,
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({q:text,source:'vi',target:'en',format:'text',...(process.env.TRANSLATION_API_KEY?{api_key:process.env.TRANSLATION_API_KEY}:{})}),
   });
   if(!response.ok)throw new Error(`Provider status ${response.status}`);
   const payload=await response.json() as {translatedText?:unknown};
   const translated=typeof payload.translatedText==='string'?payload.translatedText.trim():'';
   if(!translated||translated.length>160)throw new Error('Invalid translation response');
   return {suggestion:translated,source:'provider'};
  }catch{
   throw new BadRequestException('Translation provider is unavailable. Enter the English name manually.');
  }finally{clearTimeout(timeout)}
 }
}
@Controller('translation')@UseGuards(AuthGuard)class TranslationController{
 constructor(private db:Database,private translator:TranslationService){}
 @Post('suggest')async suggest(@Req()req:AuthedRequest,@Body()body:TranslationSuggestionDto){
  roles(req,['admin']);
  const text=body.text?.trim();
  if(!text||text.length>160)throw new BadRequestException('Invalid product name');
  // Avoid unnecessary calls and reuse already reviewed translations.
  const known=await this.db.query("select name_en from public.products where lower(name)=lower($1) and name_en is not null and trim(name_en) <> '' order by updated_at desc nulls last limit 1",[text]);
  if(known.rows[0]?.name_en)return {suggestion:known.rows[0].name_en,source:'existing'};
  return this.translator.suggest(text);
 }
}

class ProductDto{
 @IsString() @MaxLength(160) name!:string;
 @IsOptional() @IsString() @MaxLength(160) nameEn?:string;
 @IsString() @MaxLength(40) sku!:string;
 @IsUUID() categoryId!:string;
 @IsUUID() unitId!:string;
 @IsNumber() @Min(0) costPrice!:number;
 @IsInt() @Min(0) minimumStock!:number;
}
class CategoryDto{@IsString() @MaxLength(100) name!:string;@IsOptional() @IsString() @MaxLength(100) nameEn?:string}
class UnitDto{@IsString() @MaxLength(60) name!:string;@IsOptional() @IsString() @MaxLength(60) nameEn?:string;@IsString() @MaxLength(20) symbol!:string;@IsOptional() @IsString() @MaxLength(20) symbolEn?:string}
class CategoryTranslationDto{@IsString() @MaxLength(100) nameEn!:string}
class UnitTranslationDto{@IsString() @MaxLength(60) nameEn!:string;@IsString() @MaxLength(20) symbolEn!:string}
class MoveDto{@IsUUID() productId!:string;@IsIn(['IN','OUT']) type!:'IN'|'OUT';@IsInt() @Min(1) quantity!:number;@IsOptional() @IsString() @MaxLength(500) note?:string}
class RoleDto{@IsIn(['admin','staff','viewer']) role!:Role}
class CreateUserDto{
 @IsString() @MaxLength(120) displayName!:string;
 @IsString() @MaxLength(254) email!:string;
 @IsString() password!:string;
 @IsIn(['admin','staff','viewer']) role!:Role;
}
class UserStatusDto{@IsIn([true,false]) isActive!:boolean}

@Controller('health')class HealthController{constructor(private db:Database){}@Get()async health(){await this.db.query('select 1');return{status:'ok',service:'cloudstock-api',time:new Date().toISOString()}}}
@Controller('products')@UseGuards(AuthGuard)class ProductController{
 constructor(private db:Database){}
 @Get()async list(@Req()req:AuthedRequest,@Query('search')search='',@Query('page')pg='1',@Query('limit')lim='20') {roles(req,['admin','staff','viewer']);const page=Math.max(1,Number(pg)||1),limit=Math.min(100,Math.max(1,Number(lim)||20));const q=`from public.products p join public.categories c on c.id=p.category_id join public.units u on u.id=p.unit_id where p.deleted_at is null and (p.name ilike $1 or p.name_en ilike $1 or p.sku ilike $1 or c.name ilike $1 or c.name_en ilike $1)`;const terms=[`%${search}%`];const [items,count]=await Promise.all([this.db.query(`select p.*,c.name as category_name,c.name_en as category_name_en,u.symbol as unit_symbol,u.symbol_en as unit_symbol_en ${q} order by p.created_at desc limit $2 offset $3`,[...terms,limit,(page-1)*limit]),this.db.query(`select count(*)::int as count ${q}`,terms)]);return{items:items.rows,total:count.rows[0].count,page,limit}}
 @Get('archived')async archived(@Req()req:AuthedRequest,@Query('page')rawPage='1',@Query('limit')rawLimit='20',@Query('search')search=''){
  roles(req,['admin']);
  const page=Math.max(1,Math.floor(Number(rawPage)||1));
  const limit=Math.min(100,Math.max(1,Math.floor(Number(rawLimit)||20)));
  const query=`from public.products p
    join public.categories c on c.id=p.category_id
    join public.units u on u.id=p.unit_id
    where p.deleted_at is not null and (p.name ilike $1 or coalesce(p.name_en,'') ilike $1 or p.sku ilike $1)`;
  const params=[`%${search}%`];
  const [list,total]=await Promise.all([
   this.db.query(`select p.id,p.name,p.name_en,p.sku,p.stock_quantity,p.deleted_at,
     c.name as category_name,c.name_en as category_name_en,
     u.symbol as unit_symbol,u.symbol_en as unit_symbol_en
     ${query} order by p.deleted_at desc,p.id desc limit $2 offset $3`,[...params,limit,(page-1)*limit]),
   this.db.query(`select count(*)::int as count ${query}`,params)
  ]);
  return {items:list.rows,total:total.rows[0].count,page,limit};
 }
 @Patch(':id/restore')async restore(@Req()req:AuthedRequest,@Param('id')id:string){
  roles(req,['admin']);
  const restored=await this.db.query(
   'update public.products set deleted_at=null,updated_at=now() where id=$1 and deleted_at is not null returning id,sku,name,name_en,stock_quantity',
   [id]
  );
  if(!restored.rowCount)throw new NotFoundException('Archived product not found');
  return {restored:true,product:restored.rows[0]};
 }
 @Post()async create(@Req()req:AuthedRequest,@Body()b:ProductDto){roles(req,['admin']);try{const r=await this.db.query('insert into public.products(name,name_en,sku,category_id,unit_id,cost_price,minimum_stock) values($1,$2,$3,$4,$5,$6,$7) returning *',[b.name,b.nameEn?.trim()||null,b.sku.trim().toUpperCase(),b.categoryId,b.unitId,b.costPrice,b.minimumStock]);return r.rows[0]}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('Duplicate SKU');throw e}}
 @Patch(':id')async update(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:ProductDto){roles(req,['admin']);const r=await this.db.query('update public.products set name=$1,name_en=$2,sku=$3,category_id=$4,unit_id=$5,cost_price=$6,minimum_stock=$7,updated_at=now() where id=$8 and deleted_at is null returning *',[b.name,b.nameEn?.trim()||null,b.sku.trim().toUpperCase(),b.categoryId,b.unitId,b.costPrice,b.minimumStock,id]);if(!r.rowCount)throw new NotFoundException();return r.rows[0]}
 @Delete(':id')async remove(@Req()req:AuthedRequest,@Param('id')id:string){roles(req,['admin']);const r=await this.db.query('update public.products set deleted_at=now() where id=$1 and deleted_at is null returning id',[id]);if(!r.rowCount)throw new NotFoundException();return{deleted:true}}
}
@Controller('categories')@UseGuards(AuthGuard)class CategoriesController{constructor(private db:Database){}@Get()async list(){return(await this.db.query('select * from public.categories order by name')).rows}@Post()async add(@Req()req:AuthedRequest,@Body()b:CategoryDto){roles(req,['admin']);return(await this.db.query('insert into public.categories(name,name_en) values($1,$2) returning *',[b.name,b.nameEn?.trim()||null])).rows[0]}@Patch(':id/translation')async translation(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:CategoryTranslationDto){roles(req,['admin']);const r=await this.db.query('update public.categories set name_en=$1 where id=$2 returning *',[b.nameEn.trim()||null,id]);if(!r.rowCount)throw new NotFoundException();return r.rows[0]}@Delete(':id')async remove(@Req()req:AuthedRequest,@Param('id')id:string){roles(req,['admin']);await this.db.query('delete from public.categories where id=$1',[id]);return{deleted:true}}}
@Controller('units')@UseGuards(AuthGuard)class UnitsController{constructor(private db:Database){}@Get()async list(){return(await this.db.query('select * from public.units order by name')).rows}@Post()async add(@Req()req:AuthedRequest,@Body()b:UnitDto){roles(req,['admin']);return(await this.db.query('insert into public.units(name,name_en,symbol,symbol_en) values($1,$2,$3,$4) returning *',[b.name,b.nameEn?.trim()||null,b.symbol,b.symbolEn?.trim()||null])).rows[0]}@Patch(':id/translation')async translation(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:UnitTranslationDto){roles(req,['admin']);const r=await this.db.query('update public.units set name_en=$1,symbol_en=$2 where id=$3 returning *',[b.nameEn.trim()||null,b.symbolEn.trim()||null,id]);if(!r.rowCount)throw new NotFoundException();return r.rows[0]}}
@Controller('movements')@UseGuards(AuthGuard)class MovementsController{
 constructor(private db:Database){}
 @Get()async list(@Req()req:AuthedRequest,@Query('limit')raw='50'){roles(req,['admin','staff']);const limit=Math.min(100,Math.max(1,Number(raw)||50));return(await this.db.query('select m.*,p.name as product_name,p.sku,pr.role as actor_role,pr.display_name as actor_name from public.stock_movements m join public.products p on p.id=m.product_id left join public.profiles pr on pr.id=m.performed_by order by m.created_at desc limit $1',[limit])).rows}
 @Post()async create(@Req()req:AuthedRequest,@Body()b:MoveDto){roles(req,['admin','staff']);const client=await this.db.pool.connect();try{await client.query('BEGIN');const row=await client.query('select id,stock_quantity,deleted_at from public.products where id=$1 for update',[b.productId]);const p=row.rows[0];if(!p||p.deleted_at)throw new NotFoundException('Product not found');const next=p.stock_quantity+(b.type==='IN'?b.quantity:-b.quantity);if(next<0)throw new BadRequestException('Insufficient stock');await client.query('update public.products set stock_quantity=$1,updated_at=now() where id=$2',[next,b.productId]);const m=await client.query('insert into public.stock_movements(product_id,type,quantity,balance_after,note,performed_by) values($1,$2,$3,$4,$5,$6) returning *',[b.productId,b.type,b.quantity,next,b.note||null,req.user.id]);await client.query('COMMIT');return m.rows[0]}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
}
@Controller('dashboard')@UseGuards(AuthGuard)class DashboardController{constructor(private db:Database){}@Get()async view(){const [summary,history]=await Promise.all([this.db.query(`select count(*)::int as total_products,coalesce(sum(stock_quantity),0)::bigint as total_units,coalesce(sum(stock_quantity*cost_price),0)::numeric as inventory_value,count(*) filter(where stock_quantity=0)::int as out_of_stock,count(*) filter(where stock_quantity>0 and stock_quantity<minimum_stock)::int as low_stock from public.products where deleted_at is null`),this.db.query(`select date_trunc('day',created_at)::date as day,type,sum(quantity)::int as quantity from public.stock_movements where created_at>=now()-interval '30 days' group by 1,2 order by 1`)]);return{summary:summary.rows[0],history:history.rows}}}
// Phase 6: mọi báo cáo tổng hợp đều thực hiện tại PostgreSQL, không lấy mẫu 100 sản phẩm.
type Period = 'day'|'week'|'month';
const reportPeriods:Record<Period,{step:string;count:number}>={
 day:{step:'1 day',count:14},week:{step:'1 week',count:12},month:{step:'1 month',count:12},
};
const requirePeriod=(raw:string):Period=>{
 if(!['day','week','month'].includes(raw))throw new BadRequestException('Invalid reporting period');
 return raw as Period;
};
const csvCell=(input:unknown)=>{
 const plain=String(input??'');
 // Chống CSV formula injection khi mở trong Excel/LibreOffice.
 const safe=/^[\s\u0000-\u001f]*[=+@\-]/.test(plain)?`'${plain}`:plain;
 return `"${safe.replace(/"/g,'""')}"`;
};
const csvEncode=(columns:string[],rows:unknown[][])=>'\uFEFF'+[columns,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
@Controller('reports')@UseGuards(AuthGuard)class ReportsController{
 constructor(private db:Database){}
 @Get('overview')async overview(@Req()req:AuthedRequest){
  roles(req,['admin','viewer']);
  const r=await this.db.query(`select count(*)::int as total_products,
   coalesce(sum(stock_quantity),0)::bigint as total_units,
   coalesce(sum(stock_quantity*cost_price),0)::numeric as inventory_value,
   count(*) filter(where stock_quantity=0)::int as out_of_stock,
   count(*) filter(where stock_quantity>0 and stock_quantity<minimum_stock)::int as low_stock
   from public.products where deleted_at is null`);
  return r.rows[0];
 }
 @Get('trend')async trend(@Req()req:AuthedRequest,@Query('period')raw='day'){
  roles(req,['admin','staff','viewer']);
  const period=requirePeriod(raw),{step,count}=reportPeriods[period];
  // Nhóm theo giờ Việt Nam; tuần bắt đầu vào thứ Hai (PostgreSQL ISO week).
  // generate_series bổ sung các mốc không có giao dịch để biểu đồ không đứt quãng.
  const result=await this.db.query(`with periods as (
   select generate_series(
    date_trunc($1::text,now() at time zone 'Asia/Ho_Chi_Minh')-($2::int-1)*$3::interval,
    date_trunc($1::text,now() at time zone 'Asia/Ho_Chi_Minh'),$3::interval
   ) as bucket
  ), movements as (
   select date_trunc($1::text,created_at at time zone 'Asia/Ho_Chi_Minh') as bucket,
    type, sum(quantity)::bigint as amount
   from public.stock_movements
   where created_at >= ((select min(bucket) from periods) at time zone 'Asia/Ho_Chi_Minh')
   group by 1,2
  )
  select to_char(p.bucket,'YYYY-MM-DD') as period,
   coalesce(sum(m.amount) filter(where m.type='IN'),0)::bigint as inbound,
   coalesce(sum(m.amount) filter(where m.type='OUT'),0)::bigint as outbound
  from periods p left join movements m on p.bucket=m.bucket
  group by p.bucket order by p.bucket`,[period,count,step]);
  return {period,timezone:'Asia/Ho_Chi_Minh',points:result.rows};
 }
 @Get('low-stock')async low(@Req()req:AuthedRequest){
  roles(req,['admin','viewer']);
  return(await this.db.query(`select id,name,name_en,sku,stock_quantity,minimum_stock,
   greatest(minimum_stock-stock_quantity,0) as shortage,
   case when stock_quantity=0 then 'OUT' else 'LOW' end as status
   from public.products where deleted_at is null and (stock_quantity=0 or stock_quantity<minimum_stock)
   order by (stock_quantity=0) desc,shortage desc,name`)).rows;
 }
 @Get('movements')async movement(@Req()req:AuthedRequest){
  roles(req,['admin','viewer']);
  return(await this.db.query(`select date_trunc('day',created_at)::date as day,type,sum(quantity)::bigint as quantity from public.stock_movements group by 1,2 order by 1 desc limit 120`)).rows;
 }
 @Get('export')async exportCsv(@Req()req:AuthedRequest,@Query('kind')kind='inventory',@Res()res:Response){
  roles(req,['admin','viewer']);
  if(!['inventory','low-stock','movements'].includes(kind))throw new BadRequestException('Invalid report type');
  let columns:string[]=[],rows:unknown[][]=[];
  if(kind==='inventory'){
   const r=await this.db.query(`select p.sku,coalesce(nullif(p.name_en,''),p.name) as name,coalesce(nullif(c.name_en,''),c.name) as category,coalesce(nullif(u.symbol_en,''),u.symbol) as unit,
    p.stock_quantity,p.minimum_stock,p.cost_price,(p.stock_quantity*p.cost_price) as inventory_value
    from public.products p join public.categories c on c.id=p.category_id
    join public.units u on u.id=p.unit_id where p.deleted_at is null order by p.sku`);
   columns=['SKU','Product Name','Category','Unit','Stock Quantity','Minimum Stock','Cost Price (VND)','Inventory Value (VND)'];
   rows=r.rows.map(x=>[x.sku,x.name,x.category,x.unit,x.stock_quantity,x.minimum_stock,x.cost_price,x.inventory_value]);
  }else if(kind==='low-stock'){
   const r=await this.db.query(`select sku,coalesce(nullif(name_en,''),name) as name,stock_quantity,minimum_stock,
    greatest(minimum_stock-stock_quantity,0) as shortage,
    case when stock_quantity=0 then 'Out of Stock' else 'Low Stock' end as status
    from public.products where deleted_at is null and (stock_quantity=0 or stock_quantity<minimum_stock)
    order by stock_quantity,sku`);
   columns=['SKU','Product Name','Stock Quantity','Minimum Stock','Shortage','Status'];
   rows=r.rows.map(x=>[x.sku,x.name,x.stock_quantity,x.minimum_stock,x.shortage,x.status]);
  }else{
   const r=await this.db.query(`select m.created_at,p.sku,coalesce(nullif(p.name_en,''),p.name) as name,m.type,m.quantity,m.balance_after,
    coalesce(pr.display_name,'') as actor,coalesce(m.note,'') as note
    from public.stock_movements m join public.products p on p.id=m.product_id
    left join public.profiles pr on pr.id=m.performed_by order by m.created_at desc,m.id desc`);
   columns=['Timestamp (UTC)','SKU','Product Name','Movement Type','Quantity','Balance After','Performed By','Note'];
   rows=r.rows.map(x=>[new Date(x.created_at).toISOString(),x.sku,x.name,x.type,x.quantity,x.balance_after,x.actor,x.note]);
  }
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="cloudstock-${kind}-${new Date().toISOString().slice(0,10)}.csv"`);
  res.setHeader('Cache-Control','no-store');
  return res.send(csvEncode(columns,rows));
 }
}
@Controller('users')@UseGuards(AuthGuard)class UsersController{
 constructor(private db:Database){}
 private adminClient(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new BadRequestException('User management service is not configured');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 }
 @Get()async list(@Req()req:AuthedRequest){
  roles(req,['admin']);
  const rows=await this.db.query('select id,display_name,role,is_active,created_at from public.profiles order by created_at desc');
  const admin=this.adminClient();
  const emails=new Map<string,string>();
  // Admin API trả về tối đa 1000 users/page; chỉ lấy email tương ứng profiles.
  for(let page=1;page<=20;page++){
   const {data,error}=await admin.auth.admin.listUsers({page,perPage:1000});
   if(error)throw new BadRequestException('Unable to load users');
   for(const u of data.users)emails.set(u.id,u.email||'');
   if(data.users.length<1000)break;
  }
  return rows.rows.map(row=>({...row,email:emails.get(row.id)||''}));
 }
 @Post()async create(@Req()req:AuthedRequest,@Body()b:CreateUserDto){
  roles(req,['admin']);
  const email=b.email.trim().toLowerCase(),name=b.displayName.trim();
  if(!name||!/^\S+@\S+\.\S+$/.test(email))throw new BadRequestException('Invalid name or email');
  if(b.password.length<10)throw new BadRequestException('Password must contain at least 10 characters');
  const admin=this.adminClient();
  const {data,error}=await admin.auth.admin.createUser({email,password:b.password,email_confirm:true});
  if(error||!data.user)throw new BadRequestException(error?.message||'Unable to create user');
  try{
   await this.db.query('insert into public.profiles(id,display_name,role,is_active) values($1,$2,$3,true)',[data.user.id,name,b.role]);
  }catch(e){
   await admin.auth.admin.deleteUser(data.user.id);
   throw e;
  }
  return {id:data.user.id,email,display_name:name,role:b.role,is_active:true};
 }
 @Patch(':id/role')async change(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:RoleDto){
  roles(req,['admin']);
  if(req.user.id===id)throw new BadRequestException('You cannot change your own role');
  const r=await this.db.query('update public.profiles set role=$1 where id=$2 returning id,role',[b.role,id]);
  if(!r.rowCount)throw new NotFoundException();return r.rows[0];
 }
 @Patch(':id/status')async status(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:UserStatusDto){
  roles(req,['admin']);
  if(req.user.id===id)throw new BadRequestException('You cannot change your own account status');
  const existing=await this.db.query('select id,is_active from public.profiles where id=$1',[id]);
  if(!existing.rowCount)throw new NotFoundException('Account not found');
  const admin=this.adminClient();
  // Supabase Auth cấm phiên mới; AuthGuard cũng từ chối phiên/token hiện có.
  const {error}=await admin.auth.admin.updateUserById(id,{ban_duration:b.isActive?'none':'876000h'});
  if(error)throw new BadRequestException('Unable to change account status');
  try {
   const result=await this.db.query('update public.profiles set is_active=$1 where id=$2 returning id,is_active',[b.isActive,id]);
   return result.rows[0];
  }catch(e){
   // Khôi phục trạng thái Supabase Auth nếu DB cập nhật thất bại.
   await admin.auth.admin.updateUserById(id,{ban_duration:existing.rows[0].is_active?'none':'876000h'});
   throw e;
  }
 }
}
@Module({imports:[ConfigModule.forRoot({isGlobal:true})],controllers:[HealthController,AuthController,ProductController,CategoriesController,UnitsController,MovementsController,DashboardController,ReportsController,UsersController,TranslationController],providers:[Database,AuthGuard,TranslationService]})export class AppModule{}