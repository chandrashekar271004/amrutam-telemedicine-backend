import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma=new PrismaClient();
async function upsertUser(email:string,password:string,role:Role,firstName:string,lastName:string){
 const passwordHash=await bcrypt.hash(password,12);
 return prisma.user.upsert({where:{email},update:{passwordHash,role,isActive:true},create:{email,passwordHash,role,profile:{create:{firstName,lastName}}}});
}
async function main(){
 const admin=await upsertUser('admin@example.com',process.env.SEED_ADMIN_PASSWORD||'AdminPassword123!',Role.ADMIN,'System','Admin');
 const doctorUser=await upsertUser('doctor@example.com',process.env.SEED_DOCTOR_PASSWORD||'DoctorPassword123!',Role.DOCTOR,'Demo','Doctor');
 await prisma.doctor.upsert({where:{userId:doctorUser.id},update:{isVerified:true},create:{userId:doctorUser.id,specialty:'General Medicine',registrationNo:'DEMO-REG-001',consultationFee:500,experienceYears:5,isVerified:true}});
 const patient=await upsertUser('patient@example.com',process.env.SEED_PATIENT_PASSWORD||'PatientPassword123!',Role.PATIENT,'Demo','Patient');
 console.log({admin:admin.email,doctor:doctorUser.email,patient:patient.email});
}
main().catch(console.error).finally(()=>prisma.$disconnect());
