import { prisma } from '../../lib/prisma'; import { AppError } from '../../middleware/error'; import { audit } from '../audit/service';
export async function create(input:any, actorId:string){
 const user=await prisma.user.findUnique({where:{id:input.userId}}); if(!user || user.role!=='DOCTOR') throw new AppError(400,'User must have DOCTOR role','INVALID_DOCTOR_USER');
 const d=await prisma.doctor.create({data:input}); await audit({actorId,action:'DOCTOR_CREATED',resource:'Doctor',resourceId:d.id}); return d;
}
export async function search(q:any){ const page=q.page, limit=q.limit; const where:any={}; if(q.specialty) where.specialty={contains:q.specialty,mode:'insensitive'}; if(q.verified) where.isVerified=q.verified==='true'; const [items,total]=await prisma.$transaction([prisma.doctor.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{createdAt:'desc'},select:{id:true,specialty:true,bio:true,consultationFee:true,experienceYears:true,isVerified:true,user:{select:{id:true,profile:true}}}}),prisma.doctor.count({where})]); return {items,page,limit,total,totalPages:Math.ceil(total/limit)}; }
export async function verify(id:string, actorId:string){const d=await prisma.doctor.update({where:{id},data:{isVerified:true}}); await audit({actorId,action:'DOCTOR_VERIFIED',resource:'Doctor',resourceId:id}); return d;}
