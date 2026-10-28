import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { DoctorProfile, DoctorProfileSchema } from '../doctors/doctor-profile.schema';
import { MailModule } from '../mail/mail.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/user.schema';
import { DispatchOffer, DispatchOfferSchema } from './dispatch-offer.schema';
import { HomeVisitNotifications } from './home-visit-notifications';
import { HomeVisitRequest, HomeVisitRequestSchema } from './home-visit-request.schema';
import { HomeVisitRequestsService } from './home-visit-requests.service';
import { HomeVisitsController } from './home-visits.controller';
import { HomeVisitsPatientController } from './home-visits-patient.controller';
import { OpsHomeVisitsController } from './ops-home-visits.controller';
import { ProviderDispatchController } from './provider-dispatch.controller';
import { ProviderHomeVisitsController } from './provider-home-visits.controller';
import { ServiceArea, ServiceAreaSchema } from './service-area.schema';
import { ServiceAreasService } from './service-areas.service';
import { OsmMapService } from './osm-map.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceArea.name, schema: ServiceAreaSchema },
      { name: HomeVisitRequest.name, schema: HomeVisitRequestSchema },
      { name: DispatchOffer.name, schema: DispatchOfferSchema },
      { name: User.name, schema: UserSchema },
      { name: DoctorProfile.name, schema: DoctorProfileSchema },
    ]),
    AuditModule,
    PaymentsModule,
    MailModule,
    UsersModule,
  ],
  controllers: [
    HomeVisitsController,
    HomeVisitsPatientController,
    OpsHomeVisitsController,
    ProviderDispatchController,
    ProviderHomeVisitsController,
  ],
  providers: [ServiceAreasService, HomeVisitRequestsService, HomeVisitNotifications, OsmMapService],
  exports: [ServiceAreasService, HomeVisitRequestsService],
})
export class HomeVisitsModule {}
