import {prisma} from '../../lib/prisma.js'; import {AppError} from '../../middleware/error.js'; import {audit} from '../audit/service.js';
export async function create(doctorId:string,actorId:string,startsAt:string,endsAt:string){
 if(startsAt>=endsAt) throw new AppError(400,'endsAt must be after startsAt','INVALID_SLOT');
 const d=await prisma.doctor.findUnique({where:{id:doctorId}}); if(!d||d.userId!==actorId) throw new AppError(403,'Only the doctor can create their slots','FORBIDDEN');
 const s=await prisma.availabilitySlot.create({data:{doctorId,startsAt:new Date(startsAt),endsAt:new Date(endsAt)}}); await audit({actorId,action:'SLOT_CREATED',resource:'AvailabilitySlot',resourceId:s.id}); return s;
}
export async function list(doctorId:string,from:string,to:string){return prisma.availabilitySlot.findMany({where:{doctorId,startsAt:{gte:new Date(from),lt:new Date(to)},status:'AVAILABLE'},orderBy:{startsAt:'asc'}})}
