import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import {Module,Controller,Get,Post,Patch,Delete,Body,Param,Query,Req,UseGuards,Injectable,CanActivate,ExecutionContext,ForbiddenException,UnauthorizedException,BadRequestException,NotFoundException,ConflictException,OnModuleDestroy} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {createClient} from '@supabase/supabase-js';
import {Pool} from 'pg';
import {IsString,IsOptional,IsInt,IsNumber,Min,MaxLength,IsIn,IsUUID} from 'class-validator';
import type {Request} from 'express';
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
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest<AuthedRequest>();const header=req.headers.authorization||'';const token=header.startsWith('Bearer ')?header.substring(7):'';if(!token)throw new UnauthorizedException('Cần đăng nhập');
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY;if(!url||!key)throw new UnauthorizedException('Chưa cấu hình Supabase Auth');const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new UnauthorizedException('Token không hợp lệ');
 const r=await this.db.query('select role,is_active from public.profiles where id=$1',[data.user.id]);if(!r.rows[0])throw new ForbiddenException('Tài khoản chưa được cấp vai trò');if(!r.rows[0].is_active)throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');req.user={id:data.user.id,role:r.rows[0].role};return true}
}
@Controller('auth')@UseGuards(AuthGuard)class AuthController{
 @Get('me') me(@Req()req:AuthedRequest){return {id:req.user.id,role:req.user.role}}
}
const roles=(req:AuthedRequest,allowed:Role[])=>{if(!allowed.includes(req.user.role))throw new ForbiddenException('Không đủ quyền truy cập')};
class ProductDto{
 @IsString() @MaxLength(160) name!:string;
 @IsString() @MaxLength(40) sku!:string;
 @IsUUID() categoryId!:string;
 @IsUUID() unitId!:string;
 @IsNumber() @Min(0) costPrice!:number;
 @IsInt() @Min(0) minimumStock!:number;
}
class CategoryDto{@IsString() @MaxLength(100) name!:string}
class UnitDto{@IsString() @MaxLength(60) name!:string;@IsString() @MaxLength(20) symbol!:string}
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
 @Get()async list(@Req()req:AuthedRequest,@Query('search')search='',@Query('page')pg='1',@Query('limit')lim='20') {roles(req,['admin','staff','viewer']);const page=Math.max(1,Number(pg)||1),limit=Math.min(100,Math.max(1,Number(lim)||20));const q=`from public.products p join public.categories c on c.id=p.category_id join public.units u on u.id=p.unit_id where p.deleted_at is null and (p.name ilike $1 or p.sku ilike $1)`;const terms=[`%${search}%`];const [items,count]=await Promise.all([this.db.query(`select p.*,c.name as category_name,u.symbol as unit_symbol ${q} order by p.created_at desc limit $2 offset $3`,[...terms,limit,(page-1)*limit]),this.db.query(`select count(*)::int as count ${q}`,terms)]);return{items:items.rows,total:count.rows[0].count,page,limit}}
 @Post()async create(@Req()req:AuthedRequest,@Body()b:ProductDto){roles(req,['admin']);try{const r=await this.db.query('insert into public.products(name,sku,category_id,unit_id,cost_price,minimum_stock) values($1,$2,$3,$4,$5,$6) returning *',[b.name,b.sku.trim().toUpperCase(),b.categoryId,b.unitId,b.costPrice,b.minimumStock]);return r.rows[0]}catch(e){if((e as {code?:string}).code==='23505')throw new ConflictException('SKU trùng');throw e}}
 @Patch(':id')async update(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:ProductDto){roles(req,['admin']);const r=await this.db.query('update public.products set name=$1,sku=$2,category_id=$3,unit_id=$4,cost_price=$5,minimum_stock=$6,updated_at=now() where id=$7 and deleted_at is null returning *',[b.name,b.sku.trim().toUpperCase(),b.categoryId,b.unitId,b.costPrice,b.minimumStock,id]);if(!r.rowCount)throw new NotFoundException();return r.rows[0]}
 @Delete(':id')async remove(@Req()req:AuthedRequest,@Param('id')id:string){roles(req,['admin']);const r=await this.db.query('update public.products set deleted_at=now() where id=$1 and deleted_at is null returning id',[id]);if(!r.rowCount)throw new NotFoundException();return{deleted:true}}
}
@Controller('categories')@UseGuards(AuthGuard)class CategoriesController{constructor(private db:Database){}@Get()async list(){return(await this.db.query('select * from public.categories order by name')).rows}@Post()async add(@Req()req:AuthedRequest,@Body()b:CategoryDto){roles(req,['admin']);return(await this.db.query('insert into public.categories(name) values($1) returning *',[b.name])).rows[0]}@Delete(':id')async remove(@Req()req:AuthedRequest,@Param('id')id:string){roles(req,['admin']);await this.db.query('delete from public.categories where id=$1',[id]);return{deleted:true}}}
@Controller('units')@UseGuards(AuthGuard)class UnitsController{constructor(private db:Database){}@Get()async list(){return(await this.db.query('select * from public.units order by name')).rows}@Post()async add(@Req()req:AuthedRequest,@Body()b:UnitDto){roles(req,['admin']);return(await this.db.query('insert into public.units(name,symbol) values($1,$2) returning *',[b.name,b.symbol])).rows[0]}}
@Controller('movements')@UseGuards(AuthGuard)class MovementsController{
 constructor(private db:Database){}
 @Get()async list(@Req()req:AuthedRequest,@Query('limit')raw='50'){roles(req,['admin','staff']);const limit=Math.min(100,Math.max(1,Number(raw)||50));return(await this.db.query('select m.*,p.name as product_name,p.sku,pr.role as actor_role,pr.display_name as actor_name from public.stock_movements m join public.products p on p.id=m.product_id left join public.profiles pr on pr.id=m.performed_by order by m.created_at desc limit $1',[limit])).rows}
 @Post()async create(@Req()req:AuthedRequest,@Body()b:MoveDto){roles(req,['admin','staff']);const client=await this.db.pool.connect();try{await client.query('BEGIN');const row=await client.query('select id,stock_quantity,deleted_at from public.products where id=$1 for update',[b.productId]);const p=row.rows[0];if(!p||p.deleted_at)throw new NotFoundException('Không tìm thấy sản phẩm');const next=p.stock_quantity+(b.type==='IN'?b.quantity:-b.quantity);if(next<0)throw new BadRequestException('Không thể xuất quá số lượng tồn kho');await client.query('update public.products set stock_quantity=$1,updated_at=now() where id=$2',[next,b.productId]);const m=await client.query('insert into public.stock_movements(product_id,type,quantity,balance_after,note,performed_by) values($1,$2,$3,$4,$5,$6) returning *',[b.productId,b.type,b.quantity,next,b.note||null,req.user.id]);await client.query('COMMIT');return m.rows[0]}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
}
@Controller('dashboard')@UseGuards(AuthGuard)class DashboardController{constructor(private db:Database){}@Get()async view(){const [summary,history]=await Promise.all([this.db.query(`select count(*)::int as total_products,coalesce(sum(stock_quantity),0)::bigint as total_units,coalesce(sum(stock_quantity*cost_price),0)::numeric as inventory_value,count(*) filter(where stock_quantity=0)::int as out_of_stock,count(*) filter(where stock_quantity>0 and stock_quantity<minimum_stock)::int as low_stock from public.products where deleted_at is null`),this.db.query(`select date_trunc('day',created_at)::date as day,type,sum(quantity)::int as quantity from public.stock_movements where created_at>=now()-interval '30 days' group by 1,2 order by 1`)]);return{summary:summary.rows[0],history:history.rows}}}
@Controller('reports')@UseGuards(AuthGuard)class ReportsController{constructor(private db:Database){}@Get('low-stock')async low(@Req()req:AuthedRequest){roles(req,['admin','viewer']);return(await this.db.query('select id,name,sku,stock_quantity,minimum_stock,minimum_stock-stock_quantity as shortage from public.products where deleted_at is null and stock_quantity<minimum_stock order by shortage desc')).rows}@Get('movements')async movement(@Req()req:AuthedRequest){roles(req,['admin','viewer']);return(await this.db.query(`select date_trunc('day',created_at)::date as day,type,sum(quantity)::int as quantity from public.stock_movements group by 1,2 order by 1 desc limit 120`)).rows}}
@Controller('users')@UseGuards(AuthGuard)class UsersController{
 constructor(private db:Database){}
 private adminClient(){
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new BadRequestException('Chưa cấu hình dịch vụ quản lý tài khoản');
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
   if(error)throw new BadRequestException('Không tải được danh sách tài khoản');
   for(const u of data.users)emails.set(u.id,u.email||'');
   if(data.users.length<1000)break;
  }
  return rows.rows.map(row=>({...row,email:emails.get(row.id)||''}));
 }
 @Post()async create(@Req()req:AuthedRequest,@Body()b:CreateUserDto){
  roles(req,['admin']);
  const email=b.email.trim().toLowerCase(),name=b.displayName.trim();
  if(!name||!/^\S+@\S+\.\S+$/.test(email))throw new BadRequestException('Tên hoặc email không hợp lệ');
  if(b.password.length<10)throw new BadRequestException('Mật khẩu phải có ít nhất 10 ký tự');
  const admin=this.adminClient();
  const {data,error}=await admin.auth.admin.createUser({email,password:b.password,email_confirm:true});
  if(error||!data.user)throw new BadRequestException(error?.message||'Không thể tạo tài khoản');
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
  if(req.user.id===id)throw new BadRequestException('Không thể tự đổi vai trò');
  const r=await this.db.query('update public.profiles set role=$1 where id=$2 returning id,role',[b.role,id]);
  if(!r.rowCount)throw new NotFoundException();return r.rows[0];
 }
 @Patch(':id/status')async status(@Req()req:AuthedRequest,@Param('id')id:string,@Body()b:UserStatusDto){
  roles(req,['admin']);
  if(req.user.id===id)throw new BadRequestException('Không thể tự khóa hoặc mở khóa tài khoản');
  const existing=await this.db.query('select id,is_active from public.profiles where id=$1',[id]);
  if(!existing.rowCount)throw new NotFoundException('Tài khoản không tồn tại');
  const admin=this.adminClient();
  // Supabase Auth cấm phiên mới; AuthGuard cũng từ chối phiên/token hiện có.
  const {error}=await admin.auth.admin.updateUserById(id,{ban_duration:b.isActive?'none':'876000h'});
  if(error)throw new BadRequestException('Không thay đổi được trạng thái tài khoản');
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
@Module({imports:[ConfigModule.forRoot({isGlobal:true})],controllers:[HealthController,AuthController,ProductController,CategoriesController,UnitsController,MovementsController,DashboardController,ReportsController,UsersController],providers:[Database,AuthGuard]})export class AppModule{}