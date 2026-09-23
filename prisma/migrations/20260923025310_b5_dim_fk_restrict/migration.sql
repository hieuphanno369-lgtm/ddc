-- DropForeignKey
ALTER TABLE "fact_daily_equipment_usage" DROP CONSTRAINT "fact_daily_equipment_usage_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "fact_daily_equipment_usage" DROP CONSTRAINT "fact_daily_equipment_usage_equipmentId_fkey";

-- DropForeignKey
ALTER TABLE "fact_daily_manpower" DROP CONSTRAINT "fact_daily_manpower_contractorId_fkey";

-- DropForeignKey
ALTER TABLE "project_contractor" DROP CONSTRAINT "project_contractor_contractorId_fkey";

-- AddForeignKey
ALTER TABLE "project_contractor" ADD CONSTRAINT "project_contractor_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "dim_contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_manpower" ADD CONSTRAINT "fact_daily_manpower_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "dim_contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_equipment_usage" ADD CONSTRAINT "fact_daily_equipment_usage_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "dim_contractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_daily_equipment_usage" ADD CONSTRAINT "fact_daily_equipment_usage_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "dim_equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
