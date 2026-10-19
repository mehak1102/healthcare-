import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { AdminPublicHolidaysController } from './admin-public-holidays.controller';
import { CalendarController } from './calendar.controller';
import { PublicHoliday, PublicHolidaySchema } from './public-holiday.schema';
import { PublicHolidaysService } from './public-holidays.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PublicHoliday.name, schema: PublicHolidaySchema }]),
    AuditModule,
  ],
  controllers: [CalendarController, AdminPublicHolidaysController],
  providers: [PublicHolidaysService],
  exports: [PublicHolidaysService],
})
export class CalendarModule {}
