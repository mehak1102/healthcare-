import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { User, UserSchema } from '../users/user.schema';
import { DispatchOffer, DispatchOfferSchema } from './dispatch-offer.schema';
import { HomeVisitRequest, HomeVisitRequestSchema } from './home-visit-request.schema';
import { HomeVisitRequestsService } from './home-visit-requests.service';
import { HomeVisitsController } from './home-visits.controller';
import { HomeVisitsPatientController } from './home-visits-patient.controller';
import { OpsHomeVisitsController } from './ops-home-visits.controller';
import { ProviderDispatchController } from './provider-dispatch.controller';
import { ServiceArea, ServiceAreaSchema } from './service-area.schema';
import { ServiceAreasService } from './service-areas.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ServiceArea.name, schema: ServiceAreaSchema },
      { name: HomeVisitRequest.name, schema: HomeVisitRequestSchema },
      { name: DispatchOffer.name, schema: DispatchOfferSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditModule,
  ],
  controllers: [
    HomeVisitsController,
    HomeVisitsPatientController,
    OpsHomeVisitsController,
    ProviderDispatchController,
  ],
  providers: [ServiceAreasService, HomeVisitRequestsService],
  exports: [ServiceAreasService, HomeVisitRequestsService],
})
export class HomeVisitsModule {}
