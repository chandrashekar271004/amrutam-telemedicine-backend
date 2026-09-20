import {prisma} from '../../lib/prisma'; import {AppError} from '../../middleware/error'; import {audit} from '../audit/service';
export async function book(patientId:string,slotId:string,reason?:string){
 const result=await prisma.$transaction(async tx=>{
   const slot=await tx.availabilitySlot.findUnique({where:{id:slotId}}); if(!slot) throw new AppError(404,'Slot not found','SLOT_NOT_FOUND');
   if(slot.startsAt<=new Date()) throw new AppError(400,'Cannot book a past slot','PAST_SLOT');
   const claimed=await tx.availabilitySlot.updateMany({where:{id:slotId,status:'AVAILABLE'},data:{status:'BOOKED',version:{increment:1}}});
   if(claimed.count!==1) throw new AppError(409,'Slot is no longer available','SLOT_ALREADY_BOOKED');
   const consultation = await tx.consultation.create({
  data: {
    patientId,
    doctorId: slot.doctorId,
    slotId,
    reason,
    scheduledAt: slot.startsAt,
  },
}); await tx.payment.create({data:{consultationId:consultation.id,userId:patientId,amount:(await tx.doctor.findUniqueOrThrow({where:{id:slot.doctorId}})).consultationFee}}); return consultation;
 },{isolationLevel:'Serializable'});
 await audit({actorId:patientId,action:'CONSULTATION_BOOKED',resource:'Consultation',resourceId:result.id}); return result;
}
export async function updateStatus(actor:{id:string;role:any},id:string,status:any,notes?:string){
 const c=await prisma.consultation.findUnique({where:{id},include:{slot:true,doctorProfile:true}}); if(!c) throw new AppError(404,'Consultation not found','NOT_FOUND');
 if(actor.role==='PATIENT' && !['CANCELLED'].includes(status)) throw new AppError(403,'Patient can only cancel','FORBIDDEN');
 if(actor.role==='PATIENT' && c.patientId!==actor.id) throw new AppError(403,'Forbidden','FORBIDDEN');
 if(actor.role==='DOCTOR' && c.doctorId!==actor.id) throw new AppError(403,'Forbidden','FORBIDDEN');
 const updated=await prisma.$transaction(async tx=>{const x=await tx.consultation.update({where:{id},data:{status,notes,completedAt:status==='COMPLETED'?new Date():undefined}}); if(status==='CANCELLED') await tx.availabilitySlot.update({where:{id:c.slotId},data:{status:'AVAILABLE'}}); return x;});
 await audit({actorId:actor.id,action:`CONSULTATION_${status}`,resource:'Consultation',resourceId:id}); return updated;
}
export async function list(actor:{id:string;role:any},q:any){const page=q.page,limit=q.limit; const where:any=actor.role==='PATIENT'?{patientId:actor.id}:actor.role==='DOCTOR'?{doctorId:actor.id}:{}; if(q.status)where.status=q.status; const [items,total]=await prisma.$transaction([prisma.consultation.findMany({where,include:{slot:true,patient:{select:{id:true,profile:true}},doctorProfile:true,prescription:true},orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:limit}),prisma.consultation.count({where})]); return {items,page,limit,total,totalPages:Math.ceil(total/limit)};}
